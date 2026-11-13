const staffOnly = (req, res, next) => {
  if (!req.user || !["staff", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Staff access required."
    });
  }

  next();
};

module.exports = { staffOnly };
