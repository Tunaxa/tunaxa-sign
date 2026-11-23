INSERT INTO organizations (id, name, slug, plan, "updatedAt") 
VALUES ('org_demo_1', 'Demo Organization', 'demo-org', 'ENTERPRISE', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, "organizationId", email, "passwordHash", "firstName", "lastName", role, "updatedAt")
VALUES 
('usr_owner_1', 'org_demo_1', 'admin@tunaxa.com', '$argon2id$v=19$m=65536,t=3,p=4$3dxx1ec6au7lX5g5RypBQg$H5AKTXMYjawIxLkhmB6bBdMtwu5jqUHSjEegWKJGDDw', 'System', 'Admin', 'OWNER', NOW()),
('usr_user_1', 'org_demo_1', 'user@tunaxa.com', '$argon2id$v=19$m=65536,t=3,p=4$3dxx1ec6au7lX5g5RypBQg$H5AKTXMYjawIxLkhmB6bBdMtwu5jqUHSjEegWKJGDDw', 'Demo', 'User', 'MEMBER', NOW())
ON CONFLICT (id) DO NOTHING;
