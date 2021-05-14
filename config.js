module.exports = {
  database: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'development_database',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'fabe2323acc1b559dee43d4a1e16cbeb',
    cookie: {},
  },
};
