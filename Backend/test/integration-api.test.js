import test from "node:test";
import assert from "node:assert/strict";

test("API CRUD et isolation multi-tenant sur PostgreSQL", { skip: process.env.RUN_INTEGRATION_TESTS !== "true" }, async (t) => {
    const [{ default: request }, { default: bcrypt }, { runMigrations }, { app }, { default: pool }, { default: sharp }] = await Promise.all([
        import("supertest"), import("bcryptjs"), import("../database/migrate.js"), import("../server.js"), import("../config/database.js"), import("sharp"),
    ]);
    await runMigrations();
    const password = "Integration-Test-Password-42!";
    const hash = await bcrypt.hash(password, 4);
    const firstCompany = await pool.query("INSERT INTO entreprises(nom) VALUES('Tenant A') RETURNING id");
    const secondCompany = await pool.query("INSERT INTO entreprises(nom) VALUES('Tenant B') RETURNING id");
    const admin = await pool.query(
        `INSERT INTO utilisateurs(entreprise_id,nom,email,password,role,conditions_version)
         VALUES($1,'Admin A','admin-a@example.test',$2,'ADMIN','2026-07-17') RETURNING id`,
        [firstCompany.rows[0].id, hash]
    );
    await pool.query(
        `INSERT INTO utilisateurs(entreprise_id,nom,email,password,role,conditions_version)
         VALUES($1,'Admin B','admin-b@example.test',$2,'ADMIN','2026-07-17')`,
        [secondCompany.rows[0].id, hash]
    );
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin-a@example.test", password }).expect(200);
    const created = await agent.post("/api/clients").send({ nom: "Client test", email: "client@example.test" }).expect(201);
    assert.equal(created.body.entreprise_id, firstCompany.rows[0].id);
    await agent.put(`/api/clients/${created.body.id}`).send({ nom: "Client modifié", email: "client@example.test", report_emails: [] }).expect(200);
    const equipment = await agent.post("/api/equipements").send({ client_id: created.body.id, type: "Pompe", numero_serie: "TEST-001" }).expect(201);
    await agent.put(`/api/equipements/${equipment.body.id}`).send({ client_id: created.body.id, type: "Pompe révisée", numero_serie: "TEST-001" }).expect(200);
    const intervention = await agent.post("/api/interventions").send({
        client_id: created.body.id,
        equipement_id: equipment.body.id,
        creation_type: "PLANIFIEE",
        statut: "PLANIFIEE",
        titre: "Maintenance préventive",
        date_intervention: "2026-07-20",
        heure: "08:00",
        donnees_rapport: {},
    }).expect(201);
    assert.match(intervention.body.numero_rapport, /^\d{4}-\d{4}$/);
    const photoBuffer = await sharp({
        create: { width: 8, height: 12, channels: 3, background: "#2563eb" },
    }).png().toBuffer();
    const photo = await agent.post(`/api/uploads/photo/${intervention.body.id}`)
        .attach("photo", photoBuffer, { filename: "test.png", contentType: "image/png" })
        .expect(201);
    const photoSource = await agent.get(`/api/uploads/photo/${photo.body.photo.id}/source`).expect(200);
    assert.equal(photoSource.headers["content-type"], "image/webp");
    assert.ok(photoSource.body.length > 0);
    const storedPhoto = await sharp(photoSource.body).metadata();
    assert.ok(storedPhoto.width > storedPhoto.height);
    await request(app).get(`/api/uploads/photo/${photo.body.photo.id}/source`).expect(401);

    const logoBuffer = await sharp({
        create: { width: 160, height: 60, channels: 3, background: "#f8fafc" },
    }).png().toBuffer();
    await agent.post("/api/uploads/company-logo")
        .attach("logo", logoBuffer, { filename: "logo.png", contentType: "image/png" })
        .expect(200);
    const logoSource = await agent.get("/api/uploads/company-logo/source").expect(200);
    assert.equal(logoSource.headers["content-type"], "image/png");
    assert.ok(logoSource.body.length > 0);

    const signatureBuffer = await sharp({
        create: { width: 120, height: 40, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    }).composite([{
        input: { create: { width: 80, height: 8, channels: 4, background: "#172554" } },
        left: 20,
        top: 16,
    }]).png().toBuffer();
    const signature = await agent.post(`/api/uploads/signature/${intervention.body.id}`)
        .send({ signatureData: `data:image/png;base64,${signatureBuffer.toString("base64")}` })
        .expect(200);
    const signatureSource = await agent.get(`/api/uploads/signature/${intervention.body.id}/source`).expect(200);
    assert.equal(signatureSource.headers["content-type"], "image/png");
    assert.ok(signatureSource.body.length > 0);

    await pool.query(
        "UPDATE interventions SET donnees_rapport = jsonb_build_object('validation', $1::text) WHERE id = $2",
        [signature.body.signature_url, intervention.body.id]
    );
    const reportSignatureSource = await agent.get(`/api/uploads/signature-field/${intervention.body.id}/validation/source`).expect(200);
    assert.equal(reportSignatureSource.headers["content-type"], "image/png");
    assert.ok(reportSignatureSource.body.length > 0);

    const pdf = await agent.get(`/api/interventions/${intervention.body.id}/pdf`).expect(200);
    assert.equal(pdf.headers["content-disposition"], `attachment; filename="rapport-${intervention.body.numero_rapport}.pdf"`);
    await agent.delete(`/api/interventions/${intervention.body.id}`).expect(204);
    await agent.delete("/api/uploads/company-logo").expect(200);
    const tenantBClient = await pool.query("INSERT INTO clients(entreprise_id,nom) VALUES($1,'Secret B') RETURNING id", [secondCompany.rows[0].id]);
    await agent.get(`/api/clients/${tenantBClient.rows[0].id}`).expect(404);
    await agent.delete(`/api/equipements/${equipment.body.id}`).expect(204);
    await agent.delete(`/api/clients/${created.body.id}`).expect(204);
    const activity = await pool.query("SELECT COUNT(*)::INTEGER AS count FROM activites WHERE entreprise_id=$1 AND utilisateur_id=$2", [firstCompany.rows[0].id, admin.rows[0].id]);
    assert.ok(activity.rows[0].count >= 4);
    t.after(async () => pool.end());
});
