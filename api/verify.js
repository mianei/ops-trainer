module.exports = (req, res) => {
  const body = req.body || {};
  const { code } = body;

  const validCode = process.env.ACCESS_CODE;

  if (!code) {
    return res.status(400).json({ success: false, msg: "未传入验证码" });
  }

  if (code === validCode) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, msg: "验证码错误" });
  }
};
