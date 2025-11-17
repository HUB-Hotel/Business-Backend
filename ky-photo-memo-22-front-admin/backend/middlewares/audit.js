module.exports =
 ({ resource, action, getTargetId, getDiff }) =>
 (req, res, next) => {
  res.on("finish", async () => {
   if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
     await AuditLog.create({
      actor: req.user?._id,
      role: req.user?.role,
      resource,
      action,
      targetId: getTargetId?.(req, res),
      diff: getDiff?.(req, res),
      ip: req.ip,
      ua: req.headers["user-agent"],
     });
    } catch (error) {}
   }
  });
  next()
 };
