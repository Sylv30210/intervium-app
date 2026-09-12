CREATE TABLE ai_conversations (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    utilisateur_id BIGINT NOT NULL,
    titre VARCHAR(160) NOT NULL DEFAULT 'Nouvelle conversation' CHECK (btrim(titre) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

CREATE TABLE ai_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(12) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL CHECK (btrim(content) <> '' AND length(content) <= 12000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_usage (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    modele VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_conversations_owner_idx ON ai_conversations (entreprise_id, utilisateur_id, updated_at DESC, id DESC);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, created_at ASC, id ASC);
CREATE INDEX ai_usage_tenant_date_idx ON ai_usage (entreprise_id, created_at DESC);
