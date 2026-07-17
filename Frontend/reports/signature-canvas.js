export function bindSignatureCanvas({ canvas, clearButton, saveButton, onSave, onEmpty }) {
    if (!canvas || canvas.dataset.ready === "true") return null;
    canvas.dataset.ready = "true";
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#172554";
    let drawing = false;
    let hasInk = false;
    const point = (event) => {
        const box = canvas.getBoundingClientRect();
        return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    canvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        const position = point(event);
        context.beginPath();
        context.moveTo(position.x, position.y);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!drawing) return;
        const position = point(event);
        context.lineTo(position.x, position.y);
        context.stroke();
        hasInk = true;
    });
    const stopDrawing = () => { drawing = false; };
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
    clearButton?.addEventListener("click", () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
    });
    saveButton?.addEventListener("click", async (event) => {
        if (!hasInk) return onEmpty?.();
        await onSave?.({ event, signatureData: canvas.toDataURL("image/png") });
    });
    return { clear: () => { context.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; } };
}
