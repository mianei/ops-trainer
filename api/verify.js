module.exports = (req, res) => {
const { code } = req.body;
if (code === process.env.ACCESS_CODE) {
res.status(200).json({ success: true });
} else {
res.status(401).json({ success: false, message: '访问码错误' });
}
};
