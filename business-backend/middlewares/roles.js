exports.requireRole = (role) => (req, res, next) => {
  const r = req.user?.role;

  if (r === role) return next();

  return res.status(403).json({ message: `${role} 권한이 필요합니다.` });
};

exports.requireBusiness = (req, res, next) => {
  if (req.user?.role === 'BUSINESS') return next();
  return res.status(403).json({ message: '사업자 권한이 필요합니다.' });
};

exports.requireAdmin = (req, res, next) => {
  if (req.user?.role === 'ADMIN') return next();
  return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
};

