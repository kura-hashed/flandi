"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  X,
  Minimize2,
  ExternalLink,
  ShoppingBag,
  User,
  Phone,
  Copy,
  Check,
} from "lucide-react";
import { ChatMessage, ShopSettings } from "@/lib/types";

interface LiveChatWidgetProps {
  settings: ShopSettings | null;
  cartSummaryText?: string;
  cartCount?: number;
  externalOpenTrigger?: number;
  preferredChannel?: "MESSENGER" | "ZALO";
  refreshTrigger?: number;
  hideFloatingButton?: boolean;
}

export function copyToClipboardInstant(text: string): boolean {
  if (!text || typeof document === "undefined") return false;
  let success = false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    success = document.execCommand("copy");
    document.body.removeChild(textarea);
  } catch {
    // Fallback
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      success = true;
    }
  } catch {
    // Ignore
  }
  return success;
}

export default function LiveChatWidget({
  settings,
  cartSummaryText,
  cartCount = 0,
  externalOpenTrigger = 0,
  preferredChannel = "MESSENGER",
  refreshTrigger = 0,
  hideFloatingButton = false,
}: LiveChatWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"MESSENGER" | "ZALO">(
    preferredChannel
  );
  const [sessionId, setSessionId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [showProfileBar, setShowProfileBar] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize or load session ID from localStorage
  useEffect(() => {
    setMounted(true);
    const savedId = localStorage.getItem("flandi_chat_session_id");
    const savedName = localStorage.getItem("flandi_chat_name") || "";
    const savedPhone = localStorage.getItem("flandi_chat_phone") || "";
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setCustomerPhone(savedPhone);

    if (savedId) {
      setSessionId(savedId);
    } else {
      const newId = `chat-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      localStorage.setItem("flandi_chat_session_id", newId);
      setSessionId(newId);
    }
  }, []);

  // Open when triggered externally (e.g. from Order page or Confirmation modal)
  useEffect(() => {
    if (externalOpenTrigger > 0) {
      setActiveChannel(preferredChannel);
      setIsOpen(true);
      if (sessionId) {
        fetchSessionMessages(sessionId);
      }
    }
  }, [externalOpenTrigger, preferredChannel]);

  useEffect(() => {
    if (refreshTrigger > 0 && sessionId) {
      fetchSessionMessages(sessionId);
    }
  }, [refreshTrigger, sessionId]);

  const fetchSessionMessages = async (sid: string) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(sid)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.session) {
        setMessages(data.session.messages || []);
      } else {
        const initRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            customerName: customerName || "Khách Web",
            customerPhone,
          }),
        });
        const initData = await initRes.json();
        if (initData.session) {
          setMessages(initData.session.messages || []);
        }
      }
    } catch (err) {
      console.error("Failed to load chat:", err);
    }
  };

  // Poll for live replies from Admin when chat box is open
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    fetchSessionMessages(sessionId);
    const timer = setInterval(() => {
      fetchSessionMessages(sessionId);
    }, 3000);
    return () => clearInterval(timer);
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textOverride?: string) => {
    const raw = (textOverride ?? inputText).trim();
    if (!raw || !sessionId || isSending) return;

    if (!textOverride) {
      setInputText("");
    }
    setIsSending(true);

    try {
      if (customerName.trim()) {
        localStorage.setItem("flandi_chat_name", customerName.trim());
      }
      if (customerPhone.trim()) {
        localStorage.setItem("flandi_chat_phone", customerPhone.trim());
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerName:
            customerName.trim() ||
            (activeChannel === "ZALO" ? "Khách Zalo Web" : "Khách Messenger Web"),
          customerPhone: customerPhone.trim(),
          sender: "CUSTOMER",
          text: raw,
          _hp_website: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "BOT",
            text: `⏱️ ${data.error || "Gửi tin nhắn không thành công, vui lòng thử lại sau giây lát!"}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (data.session) {
        setMessages(data.session.messages || []);
      }
    } catch (err) {
      console.error("Send chat error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    "🍮 Hôm nay tiệm còn những món gì?",
    "🛵 Phí ship & Freeship",
    "🎉 Đặt tiệc số lượng lớn",
    "💳 Thông tin chuyển khoản QR",
  ];

  // Safe browser HTTPS URLs that NEVER trigger Safari "cannot open page" or App Store redirects
  const fbUrl = settings?.facebookUrl || "https://www.facebook.com/tiem.flandi";
  const zaloPhone = settings?.zaloPhone || "0703166903";
  const mascotImg =
    settings?.brandKit?.mascotImage || "/images/branding/flandi-mascot.png";

  const isZaloMode = activeChannel === "ZALO";

  if (!mounted || (hideFloatingButton && !isOpen)) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
      {/* Embedded On-Page Messenger / Zalo Chat Window (Zero App Store redirect!) */}
      {isOpen && (
        <div className="w-[calc(100vw-1.5rem)] sm:w-[390px] h-[530px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border-2 border-flandi-pink flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Chat Header */}
          <div
            className={`${
              isZaloMode
                ? "bg-gradient-to-r from-[#0068FF] to-[#0052CC]"
                : "bg-gradient-to-r from-[#006AFF] via-[#0084FF] to-[#A033FF]"
            } text-white p-3.5 flex items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={mascotImg}
                  alt="FLANDI"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white"
                />
                <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-white absolute bottom-0 right-0" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-sm truncate">
                    {isZaloMode
                      ? `Zalo Trực Tiếp • ${zaloPhone}`
                      : `Messenger • ${settings?.shopName || "FLANDI"}`}
                  </h4>
                </div>
                <p className="text-[11px] text-white/90 font-medium truncate">
                  Nhắn & Gửi đơn trực tiếp trên Web • Không cần chuyển App
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowProfileBar((v) => !v)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
                title="Cập nhật tên & SĐT của bạn"
              >
                <User className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
                title="Thu gọn khung chat"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Channel Switcher + Safe External Links Bar */}
          <div className="bg-flandi-bg border-b border-flandi-pink px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-flandi-pink">
              <button
                type="button"
                onClick={() => setActiveChannel("MESSENGER")}
                className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                  !isZaloMode
                    ? "bg-[#006AFF] text-white"
                    : "text-flandi-dark hover:bg-flandi-cream"
                }`}
              >
                Messenger Web
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel("ZALO")}
                className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                  isZaloMode
                    ? "bg-[#0068FF] text-white"
                    : "text-flandi-dark hover:bg-flandi-cream"
                }`}
              >
                Zalo Web ({zaloPhone})
              </button>
            </div>

            {isZaloMode ? (
              <button
                type="button"
                onClick={() => {
                  copyToClipboardInstant(zaloPhone);
                  setCopiedPhone(true);
                  setTimeout(() => setCopiedPhone(false), 2000);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-[#0068FF] font-extrabold flex items-center gap-1 hover:bg-blue-50"
                title="Copy số điện thoại Zalo"
              >
                {copiedPhone ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Đã Copy SĐT</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy SĐT</span>
                  </>
                )}
              </button>
            ) : (
              <a
                href={fbUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-[#006AFF] font-extrabold flex items-center gap-1 hover:bg-blue-50"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Fanpage</span>
              </a>
            )}
          </div>

          {/* Optional Customer Name/Phone Bar */}
          {showProfileBar && (
            <div className="bg-flandi-cream/90 border-b border-flandi-pink px-3 py-2.5 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên của bạn..."
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink bg-white text-xs font-bold text-flandi-dark focus:outline-none"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="SĐT / Zalo của bạn..."
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink bg-white text-xs font-bold text-flandi-dark focus:outline-none"
              />
            </div>
          )}

          {/* Chat Messages Scroll Container */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FFF9F8]">
            {messages.map((msg) => {
              const isCustomer = msg.sender === "CUSTOMER";
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${
                    isCustomer ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isCustomer && (
                    <img
                      src={mascotImg}
                      alt="FLANDI"
                      className="w-7 h-7 rounded-full object-cover border border-flandi-salmon shrink-0"
                    />
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-2xs ${
                      isCustomer
                        ? isZaloMode
                          ? "bg-[#0068FF] text-white font-semibold rounded-br-xs"
                          : "bg-gradient-to-r from-[#006AFF] to-[#0084FF] text-white font-semibold rounded-br-xs"
                        : msg.sender === "SHOP"
                        ? "bg-white border-2 border-flandi-salmon text-flandi-dark font-semibold rounded-bl-xs"
                        : "bg-white border border-flandi-pink text-flandi-dark font-medium rounded-bl-xs"
                    }`}
                  >
                    {msg.sender === "SHOP" && (
                      <span className="block text-[10px] font-extrabold text-flandi-coral mb-0.5">
                        👩‍🍳 Chủ tiệm FLANDI
                      </span>
                    )}
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Pills + Send Cart Summary directly into Chat */}
          <div className="px-3 py-2 bg-white border-t border-flandi-pink/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {cartCount > 0 && cartSummaryText && (
              <button
                type="button"
                onClick={() => handleSendMessage(cartSummaryText)}
                className="px-2.5 py-1 rounded-full bg-flandi-coral text-white text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1 shrink-0 shadow-2xs"
              >
                <ShoppingBag className="w-3 h-3" />
                <span>Dán & Gửi đơn ({cartCount} món) vào đây</span>
              </button>
            )}
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink text-[11px] font-bold whitespace-nowrap shrink-0 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-flandi-pink flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isZaloMode
                  ? `Nhắn Zalo trực tiếp tới ${zaloPhone}...`
                  : "Nhắn tin trực tiếp cho FLANDI..."
              }
              className="flex-1 px-3.5 py-2 rounded-full bg-flandi-bg border border-flandi-pink text-xs font-semibold text-flandi-dark focus:border-[#006AFF] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className={`w-9 h-9 rounded-full ${
                isZaloMode
                  ? "bg-[#0068FF]"
                  : "bg-gradient-to-r from-[#006AFF] to-[#0084FF]"
              } text-white flex items-center justify-center shadow-sm disabled:opacity-40 hover:scale-105 transition shrink-0`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Buttons Row (Opens On-Page Chat — Never triggers Safari App Store error!) */}
      <div className="flex flex-col items-end gap-3">
        {/* Zalo Floating Button -> Opens On-Page Zalo Chat */}
        {(settings?.pageConfig?.showFloatingZalo ?? true) && (
          <button
            type="button"
            onClick={() => {
              if (cartSummaryText) {
                copyToClipboardInstant(cartSummaryText);
                setInputText(cartSummaryText);
              }
              setActiveChannel("ZALO");
              setIsOpen(true);
            }}
            aria-label="Nhắn tin Zalo trực tiếp trên trang"
            className="group flex items-center gap-2.5 focus:outline-none"
          >
            <span className="hidden sm:inline-block px-3.5 py-1.5 rounded-full bg-white/95 text-[#0068FF] border border-blue-200 shadow-md text-xs font-extrabold opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
              Chat Zalo trực tiếp ({zaloPhone})
            </span>
            <div className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0068FF] text-white shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-white">
              <span className="absolute inset-0 rounded-full bg-[#0068FF] animate-ping opacity-20" />
              <span className="font-display text-[13px] sm:text-sm font-black tracking-tight relative">
                Zalo
              </span>
            </div>
          </button>
        )}

        {/* On-Page Messenger Live Chat Toggle Button */}
        {(settings?.pageConfig?.showFloatingMessenger ?? true) && (
          <button
            type="button"
            onClick={() => {
              if (cartSummaryText && !isOpen) {
                copyToClipboardInstant(cartSummaryText);
                setInputText(cartSummaryText);
              }
              setActiveChannel("MESSENGER");
              setIsOpen((prev) => !prev);
            }}
            aria-label="Mở khung chat Messenger trực tiếp trên trang"
            className="group flex items-center gap-2.5 focus:outline-none"
          >
            <span className="hidden sm:inline-block px-3.5 py-1.5 rounded-full bg-white/95 text-[#006AFF] border border-blue-200 shadow-md text-xs font-extrabold opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
              {isOpen ? "Đóng khung chat" : "Chat Messenger trực tiếp"}
            </span>
            <div className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#006AFF] via-[#0099FF] to-[#A033FF] text-white shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-white">
              {!isOpen && (
                <span className="absolute inset-0 rounded-full bg-[#0084FF] animate-ping opacity-25" />
              )}
              {isOpen ? (
                <X className="w-6 h-6 relative" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 sm:w-7 sm:h-7 relative"
                >
                  <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.912 1.447 5.51 3.713 7.206V22l3.398-1.868c.905.252 1.87.388 2.889.388 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.008 12.438l-2.548-2.724-4.97 2.724 5.468-5.805 2.61 2.724 4.908-2.724-5.468 5.805z" />
                </svg>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
