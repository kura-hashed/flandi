"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  X,
  Minimize2,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  User,
  Phone,
} from "lucide-react";
import { ChatMessage, ChatSession, ShopSettings } from "@/lib/types";

interface LiveChatWidgetProps {
  settings: ShopSettings | null;
  cartSummaryText?: string;
  cartCount?: number;
  externalOpenTrigger?: number;
}

export default function LiveChatWidget({
  settings,
  cartSummaryText,
  cartCount = 0,
  externalOpenTrigger = 0,
}: LiveChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [showProfileBar, setShowProfileBar] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize or load session ID from localStorage
  useEffect(() => {
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

  // Open when triggered externally (e.g. from Order Confirmation modal)
  useEffect(() => {
    if (externalOpenTrigger > 0) {
      setIsOpen(true);
    }
  }, [externalOpenTrigger]);

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
        // Initialize welcome message on first open
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

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputText).trim();
    if (!textToSend || !sessionId || isSending) return;

    if (!customText) setInputText("");
    setIsSending(true);

    // Optimistic update
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "CUSTOMER",
      text: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      if (customerName) localStorage.setItem("flandi_chat_name", customerName);
      if (customerPhone) localStorage.setItem("flandi_chat_phone", customerPhone);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerName: customerName || "Khách Web",
          customerPhone,
          sender: "CUSTOMER",
          text: textToSend,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setMessages(data.session.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    "🍮 Tư vấn menu & giá",
    "🛵 Phí ship & Freeship",
    "🎉 Đặt tiệc số lượng lớn",
    "💳 Thông tin chuyển khoản QR",
  ];

  const fbUrl = settings?.facebookUrl || "https://www.facebook.com/tiem.flandi";
  const zaloPhone = settings?.zaloPhone || "0366053058";
  const mascotImg =
    settings?.brandKit?.mascotImage || "/images/branding/flandi-mascot.png";

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
      {/* Embedded On-Page Messenger Chat Window */}
      {isOpen && (
        <div className="w-[calc(100vw-2rem)] sm:w-[380px] h-[520px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border-2 border-flandi-pink flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Messenger Header */}
          <div className="bg-gradient-to-r from-[#006AFF] via-[#0084FF] to-[#A033FF] text-white p-3.5 flex items-center justify-between gap-2">
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
                    Messenger • {settings?.shopName || "FLANDI"}
                  </h4>
                </div>
                <p className="text-[11px] text-white/90 font-medium truncate">
                  Chat trực tiếp trên Web • Phản hồi ngay
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
              <a
                href={fbUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
                title="Mở Fanpage Facebook trong tab mới"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
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

          {/* Optional Customer Name & Phone Bar */}
          {showProfileBar ? (
            <div className="p-2.5 bg-flandi-bg border-b border-flandi-pink grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên của bạn..."
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink bg-white font-semibold focus:border-flandi-coral focus:outline-none"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="SĐT / Zalo..."
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink bg-white font-semibold focus:border-flandi-coral focus:outline-none"
              />
            </div>
          ) : (
            <div className="px-3.5 py-1.5 bg-flandi-bg/80 border-b border-flandi-pink flex items-center justify-between text-[11px]">
              <span className="text-flandi-muted font-semibold truncate">
                {customerName
                  ? `Đang chat: ${customerName} ${
                      customerPhone ? `(${customerPhone})` : ""
                    }`
                  : "Nhập tên/SĐT để tiệm liên hệ nhanh hơn"}
              </span>
              <button
                type="button"
                onClick={() => setShowProfileBar(true)}
                className="text-[#006AFF] font-extrabold hover:underline shrink-0 ml-2"
              >
                {customerName ? "Sửa" : "+ Điền tên/SĐT"}
              </button>
            </div>
          )}

          {/* Chat Messages Thread */}
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
                        ? "bg-gradient-to-r from-[#006AFF] to-[#0084FF] text-white font-semibold rounded-br-xs"
                        : "bg-white text-flandi-dark border border-flandi-pink font-medium rounded-bl-xs"
                    }`}
                  >
                    {msg.sender === "SHOP" && (
                      <span className="block text-[10px] font-extrabold text-flandi-coral mb-0.5">
                        Chủ tiệm FLANDI
                      </span>
                    )}
                    {msg.text}
                    <span
                      className={`block text-[9px] mt-1 ${
                        isCustomer ? "text-white/75 text-right" : "text-flandi-muted"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips + Send Cart Button */}
          <div className="px-3 py-2 bg-white border-t border-flandi-pink/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {cartCount > 0 && cartSummaryText && (
              <button
                type="button"
                onClick={() => handleSendMessage(cartSummaryText)}
                className="px-2.5 py-1 rounded-full bg-flandi-coral text-white text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1 shrink-0 shadow-2xs"
              >
                <ShoppingBag className="w-3 h-3" />
                <span>Gửi giỏ bánh ({cartCount})</span>
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
              placeholder="Nhắn tin trực tiếp cho FLANDI..."
              className="flex-1 px-3.5 py-2 rounded-full bg-flandi-bg border border-flandi-pink text-xs font-semibold text-flandi-dark focus:border-[#006AFF] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[#006AFF] to-[#0084FF] text-white flex items-center justify-center shadow-sm disabled:opacity-40 hover:scale-105 transition shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Buttons Row */}
      <div className="flex flex-col items-end gap-3">
        {/* Zalo Floating Button */}
        {(settings?.pageConfig?.showFloatingZalo ?? true) && (
          <a
            href={`https://zalo.me/${zaloPhone}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Nhắn tin qua Zalo"
            className="group flex items-center gap-2.5 focus:outline-none"
          >
            <span className="hidden sm:inline-block px-3.5 py-1.5 rounded-full bg-white/95 text-[#0068FF] border border-blue-200 shadow-md text-xs font-extrabold opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
              Nhắn Zalo: {zaloPhone}
            </span>
            <div className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0068FF] text-white shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-white">
              <span className="absolute inset-0 rounded-full bg-[#0068FF] animate-ping opacity-20" />
              <span className="font-display text-[13px] sm:text-sm font-black tracking-tight relative">
                Zalo
              </span>
            </div>
          </a>
        )}

        {/* On-Page Messenger Live Chat Toggle Button */}
        {(settings?.pageConfig?.showFloatingMessenger ?? true) && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
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
