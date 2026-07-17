import test from "node:test";
import assert from "node:assert/strict";

test("API CRUD et isolation multi-tenant sur PostgreSQL", { skip: process.env.RUN_INTEGRATION_TESTS !== "true" }, async (t) => {
    const [{ default: request }, { default: bcrypt }, { runMigrations }, { app }, { default: pool }] = await Promise.all([
        import("supertest"), import("bcryptjs"), import("../database/migrate.js"), import("../server.js"), import("../config/database.js"),
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
    const tenantBClient = await pool.query("INSERT INTO clients(entreprise_id,nom) VALUES($1,'Secret B') RETURNING id", [secondCompany.rows[0].id]);
    await agent.get(`/api/clients/${tenantBClient.rows[0].id}`).expect(404);
    await agent.delete(`/api/equipements/${equipment.body.id}`).expect(204);
    await agent.delete(`/api/clients/${created.body.id}`).expect(204);
    const activity = await pool.query("SELECT COUNT(*)::INTEGER AS count FROM activites WHERE entreprise_id=$1 AND utilisateur_id=$2", [firstCompany.rows[0].id, admin.rows[0].id]);
    assert.ok(activity.rows[0].count >= 4);
    t.after(async () => pool.end());
});
