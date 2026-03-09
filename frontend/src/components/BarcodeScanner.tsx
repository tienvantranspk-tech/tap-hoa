import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type BarcodeScannerProps = {
    onScan: (code: string) => void;
    onClose: () => void;
};

export const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(true);

    useEffect(() => {
        const containerId = "barcode-scanner-container";
        let stopped = false;

        const startScanner = async () => {
            try {
                const scanner = new Html5Qrcode(containerId);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 280, height: 160 },
                        aspectRatio: 1.5,
                    },
                    (decodedText) => {
                        if (!stopped) {
                            stopped = true;
                            onScan(decodedText);
                        }
                    },
                    () => {
                        // Ignore scan failures (no barcode found in frame)
                    }
                );

                setStarting(false);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Không thể mở camera. Vui lòng cấp quyền camera."
                );
                setStarting(false);
            }
        };

        startScanner();

        return () => {
            stopped = true;
            if (scannerRef.current) {
                scannerRef.current
                    .stop()
                    .then(() => scannerRef.current?.clear())
                    .catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
                    <h3 className="font-bold text-brand-800">📷 Quét mã vạch</h3>
                    <button
                        className="rounded-lg px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                        onClick={onClose}
                    >
                        Đóng
                    </button>
                </div>

                <div className="p-4">
                    {starting && (
                        <p className="mb-2 text-center text-sm text-brand-700/70">
                            Đang mở camera...
                        </p>
                    )}

                    {error ? (
                        <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
                            {error}
                        </div>
                    ) : (
                        <div
                            id="barcode-scanner-container"
                            ref={containerRef}
                            className="overflow-hidden rounded-lg"
                        />
                    )}

                    <p className="mt-3 text-center text-xs text-brand-700/60">
                        Hướng camera vào mã vạch sản phẩm để quét
                    </p>
                </div>
            </div>
        </div>
    );
};
