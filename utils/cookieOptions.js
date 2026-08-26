function isProduction(env = process.env.NODE_ENV) {
  return env === "production";
}

function getAuthCookieOptions({ maxAge, env } = {}) {
  const production = isProduction(env);

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

module.exports = {
  getAuthCookieOptions,
};
