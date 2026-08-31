const { verifyAccessToken } = require('../lib/jwt');
const { AppError } = require('../lib/apiError');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];
    const tokenFromCookie = req.cookies ? req.cookies.accessToken : null;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
        return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required. No token provided.'));
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return next(new AppError(403, 'AUTH_INVALID_TOKEN', 'Invalid or expired access token.'));
    }
}

module.exports = {
    authenticateToken
};
