import app from "./app";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`🚀 (Local) Print Shipping Engine running on http://127.0.0.1:${PORT}`);
});
