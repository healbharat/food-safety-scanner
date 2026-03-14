/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Camera, Upload, ShieldCheck, AlertTriangle, Loader2, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface AnalysisResult {
  isFood: boolean;
  safe: boolean;
  score: number;
  explanation: string;
  detectedIssues: string[];
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please ensure you have granted permission.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);
    const model = "gemini-2.0-flash"; // Moved outside try/catch for scope

    const attemptAnalysis = async (modelName: string): Promise<void> => {
      try {
        const base64Data = image.split(',')[1];
        const prompt = `Analyze this image. 
        First, determine if the main object in the image is a food item.
        Return the analysis in JSON format with the following structure:
        {
          "isFood": boolean (true if it's food, false otherwise),
          "safe": boolean (only relevant if isFood is true),
          "score": number (0-100, where 100 is perfectly safe. Only relevant if isFood is true. If not food, set to 0),
          "explanation": "string explaining the findings. If not food, explain what was seen instead (e.g., 'The main objects are a smartphone, a person')",
          "detectedIssues": ["string list of specific issues found like fungus, mold, rot, or empty if none"]
        }
        If it's food, check specifically for fungus, mold, rot, or any signs of spoilage.
        If fungus is detected, the score must be low (below 40). If it looks perfectly safe, the score should be high (above 90).`;

        const response = await genAI.models.generateContent({
          model: modelName,
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json"
          }
        });

        const text = response.text;
        if (text) {
          const parsedResult = JSON.parse(text) as AnalysisResult;
          setResult(parsedResult);
        } else {
          throw new Error("No analysis received from AI.");
        }
      } catch (err: any) {
        throw err;
      }
    };

    try {
      await attemptAnalysis("gemini-2.0-flash");
    } catch (err: any) {
      console.error("Primary model failed:", err);
      const errorMessage = err.message || String(err);

      // Trigger fallback if quota reached or model not found
      if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota") || errorMessage.includes("404") || errorMessage.includes("not found")) {
        console.log("Attempting fallback to gemini-2.0-flash-lite...");
        try {
          await attemptAnalysis("gemini-2.0-flash-lite");
        } catch (fallbackErr: any) {
          console.log("Falling back to gemini-2.5-flash...");
          try {
            await attemptAnalysis("gemini-2.5-flash");
          } catch (finalErr: any) {
            console.error("All available models failed:", finalErr);
            const finalMsg = finalErr.message || String(finalErr);
            if (finalMsg.includes("RESOURCE_EXHAUSTED")) {
              setError("API quota reached for all available models (Gemini 2.0 & 2.5). Please try again later.");
            } else {
              setError(`Analysis failed: ${finalMsg}`);
            }
          }
        }
      } else if (errorMessage.includes("API_KEY_INVALID")) {
        setError("Invalid API Key. Please check your .env file.");
      } else {
        setError(`Failed to analyze: ${errorMessage}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen mesh-bg selection:bg-emerald-100 py-12 px-4 flex flex-col items-center">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-50/50 rounded-full blur-3xl" />
      </div>

      <header className="max-w-xl w-full text-center mb-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl border border-emerald-50 mb-6 group cursor-default"
        >
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
        </motion.div>
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-3 bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-500">
          SmartScan Food
        </h1>
        <p className="text-slate-500 text-lg font-medium">Real-time AI Food Safety Analysis</p>
      </header>

      <main className="max-w-xl w-full relative z-10">
        <AnimatePresence mode="wait">
          {isCameraOpen ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-black shadow-2xl border-4 border-white">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[20px] border-black/10 pointer-events-none" />
                <div className="absolute bottom-10 inset-x-0 flex justify-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={capturePhoto}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-all"
                  >
                    <div className="w-16 h-16 border-4 border-emerald-600 rounded-full flex items-center justify-center">
                      <div className="w-12 h-12 bg-emerald-600 rounded-full animate-pulse" />
                    </div>
                  </motion.button>
                </div>
              </div>
              <button
                onClick={stopCamera}
                className="w-full glass hover:bg-white text-slate-600 font-semibold py-5 rounded-[2rem] transition-all flex items-center justify-center gap-2"
              >
                Close Camera
              </button>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          ) : !image ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-12 border-2 border-dashed border-emerald-100 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-400 group transition-all shadow-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mb-8 group-hover:bg-emerald-100 transition-colors group-hover:rotate-6">
                  <Upload className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">Snap or Upload</h2>
                <p className="text-slate-400 max-w-[240px] leading-relaxed">
                  Upload a photo of any food item to check for freshness and safety.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </motion.div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startCamera}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-xl shadow-emerald-200"
                >
                  <Camera className="w-8 h-8" />
                  <span>Use Camera</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="glass hover:bg-white text-emerald-700 font-bold py-6 rounded-[2rem] flex flex-col items-center justify-center gap-3"
                >
                  <Upload className="w-8 h-8" />
                  <span>Gallery</span>
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-white shadow-2xl border-4 border-white group">
                <img src={image} alt="Food analysis" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-emerald-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
                    <div className="scan-line" />
                    <Loader2 className="w-16 h-16 animate-spin mb-6 text-emerald-300" />
                    <p className="text-2xl font-bold tracking-tight text-center">AI Intelligence at Work...</p>
                    <p className="text-emerald-100/70 text-sm mt-2">Checking for mold, fungus & spoilage</p>
                  </div>
                )}
                
                {!isAnalyzing && !result && (
                  <div className="absolute inset-x-0 bottom-0 p-8 pt-20 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="flex gap-4">
                      <button
                        onClick={analyzeImage}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        Launch Analysis
                      </button>
                      <button
                        onClick={reset}
                        className="w-16 h-16 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-2xl flex items-center justify-center transition-all"
                      >
                        <RefreshCw className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2.5rem] flex items-start gap-4 text-rose-700 shadow-sm"
                >
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Issue Encountered</h4>
                    <p className="text-sm opacity-80 leading-relaxed font-medium">{error}</p>
                  </div>
                </motion.div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/90 backdrop-blur-xl rounded-[3rem] p-10 shadow-2xl border border-white space-y-8"
                >
                  {result.isFood ? (
                    <>
                      <div className="flex flex-col items-center text-center">
                        <div className="relative mb-8 pt-4">
                          {/* Premium Score Gauge */}
                          <svg className="w-48 h-48 transform -rotate-90">
                            <circle
                              cx="96" cy="96" r="88"
                              className="stroke-slate-100 fill-none"
                              strokeWidth="12"
                            />
                            <motion.circle
                              cx="96" cy="96" r="88"
                              className={`fill-none ${result.score > 70 ? 'stroke-emerald-500' : result.score > 40 ? 'stroke-amber-500' : 'stroke-rose-500'}`}
                              strokeWidth="12"
                              strokeLinecap="round"
                              initial={{ strokeDasharray: "0 553" }}
                              animate={{ strokeDasharray: `${(result.score / 100) * 553} 553` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-6xl font-black text-slate-800 tracking-tighter">{result.score}</span>
                            <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Quality</span>
                          </div>
                        </div>
                        
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 1 }}
                          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black uppercase tracking-widest ${result.safe ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                        >
                          {result.safe ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          {result.safe ? 'Consumable' : 'Spoilage Detected'}
                        </motion.div>
                      </div>

                      <div className="grid gap-6">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                          <div className="flex items-center gap-2 mb-3 text-slate-800 font-bold">
                            <Info className="w-5 h-5 text-emerald-500" />
                            <h4>AI Analysis Report</h4>
                          </div>
                          <p className="text-slate-600 leading-relaxed font-medium italic">
                            "{result.explanation}"
                          </p>
                        </div>

                        {result.detectedIssues.length > 0 && (
                          <div className="space-y-3 px-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Key Findings</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.detectedIssues.map((issue, i) => (
                                <motion.span 
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 1.2 + (i * 0.1) }}
                                  key={i} 
                                  className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold border border-emerald-100"
                                >
                                  {issue}
                                </motion.span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 px-4">
                      <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-10 h-10 text-amber-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-4">No Food Detected</h3>
                      <p className="text-slate-500 mb-8 leading-relaxed">
                        {result.explanation}. Please scan a clear photo of food instead.
                      </p>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={reset}
                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] transition-all shadow-xl shadow-slate-200 mt-4 flex items-center justify-center gap-3"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>{result.isFood ? 'New Scan' : 'Scan Another Item'}</span>
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-16 p-8 glass rounded-[3rem] border-white/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-slate-800 font-bold text-lg">Safety Assurance</h3>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed font-medium">
            This proprietary AI uses advanced computer vision to identify spoilage. 
            <span className="text-amber-700 font-bold block mt-2">However, visual analysis is not infallible. Always use your senses—smell and touch—before consumption. "When in doubt, throw it out."</span>
          </p>
        </section>
      </main>
      
      <footer className="mt-12 text-slate-400 text-sm font-medium">
        © 2026 SmartScan AI • Precision Food Safety
      </footer>
    </div>
  );
}
