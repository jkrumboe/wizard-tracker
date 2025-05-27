-- Update user passwords with correct bcryptjs hash
UPDATE users SET password_hash = '$2b$10$RCH1ppbrOWfDN8JZ3e39vO9Jlj1LEhMLRC2fDM82dAyhkH4NpHYI.' WHERE username IN ('testuser', 'player1', 'player2', 'gamer123', 'wizardpro', 'admin');

-- Verify the update
SELECT username, LEFT(password_hash, 20) as hash_preview FROM users;
