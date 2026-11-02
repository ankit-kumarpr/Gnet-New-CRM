import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  MessageCircle,
  MoreVertical,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import api from "../../services/api";
import { connectChatSocket, disconnectChatSocket, getChatSocket } from "../../services/chatSocket";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../utils/cn";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function formatBubbleTime(value) {
  if (!value) return "";
  return timeFmt.format(new Date(value));
}

function formatListTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return timeFmt.format(date);
  return dayFmt.format(date);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function Avatar({ name, url, size = "md" }) {
  const dim = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-sm";
  if (url) {
    return <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", dim)} />;
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#00a884] font-semibold text-white", dim)}>
      {initials(name)}
    </div>
  );
}

export function Chat() {
  const { user, token, hasPermission } = useAuth();
  const me = useMemo(() => ({
    refId: user?._id || user?.id,
    kind: "USER",
    name: user?.name || "You",
  }), [user]);
  const canStartChats = hasPermission(["CREATE_CHAT_GROUPS", "MANAGE_CHAT"]);

  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [typingName, setTypingName] = useState("");
  const [listQuery, setListQuery] = useState("");
  const debouncedListQuery = useDebouncedValue(listQuery, 250);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiWrapRef = useRef(null);

  const [showNew, setShowNew] = useState(false);
  const [newTab, setNewTab] = useState("dm");
  const [peopleQ, setPeopleQ] = useState("");
  const debouncedPeopleQ = useDebouncedValue(peopleQ, 300);
  const [people, setPeople] = useState({ employees: [] });
  const [groupName, setGroupName] = useState("");
  const [pickedEmployees, setPickedEmployees] = useState([]);
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showInfo, setShowInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState(null);

  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const activeIdRef = useRef("");
  const [editAvatarPreview, setEditAvatarPreview] = useState("");

  const activeRoom = rooms.find((row) => String(row._id) === String(activeId)) || null;

  useEffect(() => {
    if (!editAvatar) {
      setEditAvatarPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(editAvatar);
    setEditAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editAvatar]);
  const isMine = (msg) => msg.sender?.kind === me.kind && String(msg.sender?.refId) === String(me.refId);

  const loadRooms = useCallback(async (search = "") => {
    try {
      setLoadingRooms(true);
      const res = await api.get("/chat/rooms", { params: { search: search || undefined } });
      setRooms(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load chats");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(async (roomId, { before } = {}) => {
    if (!roomId) return;
    try {
      if (!before) setLoadingMessages(true);
      const res = await api.get(`/chat/rooms/${roomId}/messages`, {
        params: { limit: 40, before: before || undefined },
      });
      const rows = res.data.data || [];
      setHasMore(Boolean(res.data.hasMore));
      if (before) {
        setMessages((prev) => [...rows, ...prev]);
      } else {
        setMessages(rows);
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadRooms(debouncedListQuery);
  }, [debouncedListQuery, loadRooms]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = connectChatSocket(token);

    const onMessage = (msg) => {
      if (String(msg.room) === String(activeIdRef.current)) {
        setMessages((prev) => (prev.some((row) => String(row._id) === String(msg._id)) ? prev : [...prev, msg]));
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      }
    };
    const onRoomUpdated = (payload) => {
      setRooms((prev) => {
        const next = prev.map((room) =>
          String(room._id) === String(payload.roomId)
            ? {
                ...room,
                lastMessageAt: payload.lastMessageAt,
                lastMessageText: payload.lastMessageText,
                lastMessageSenderName: payload.lastMessageSenderName,
              }
            : room,
        );
        next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
        return [...next];
      });
    };
    const onTyping = (payload) => {
      if (String(payload.roomId) !== String(activeIdRef.current)) return;
      if (payload.actor && payload.actor.kind === me.kind && String(payload.actor.refId) === String(me.refId)) return;
      setTypingName(payload.typing ? payload.name : "");
      if (payload.typing) {
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTypingName(""), 2000);
      }
    };
    const onGroupUpdated = (room) => {
      if (!room?._id) return;
      setRooms((prev) => prev.map((row) => (String(row._id) === String(room._id) ? { ...row, ...room } : row)));
    };
    const leaveRoomLocally = (roomId, toastMsg) => {
      setRooms((prev) => prev.filter((row) => String(row._id) !== String(roomId)));
      if (String(activeIdRef.current) === String(roomId)) {
        setActiveId("");
        setMessages([]);
        setShowInfo(false);
        setMobileShowChat(false);
      }
      if (toastMsg) toast(toastMsg);
    };
    const onRemovedFromGroup = (payload) => {
      leaveRoomLocally(payload?.roomId, payload?.name ? `Removed from ${payload.name}` : "Removed from group");
    };
    const onGroupDeleted = (payload) => {
      leaveRoomLocally(payload?.roomId, payload?.name ? `${payload.name} was deleted` : "Group deleted");
    };
    const onRoomAdded = (room) => {
      if (!room?._id) return;
      setRooms((prev) => {
        if (prev.some((row) => String(row._id) === String(room._id))) {
          return prev.map((row) => (String(row._id) === String(room._id) ? { ...row, ...room } : row));
        }
        return [room, ...prev];
      });
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:room-updated", onRoomUpdated);
    socket.on("chat:typing", onTyping);
    socket.on("chat:group-updated", onGroupUpdated);
    socket.on("chat:removed-from-group", onRemovedFromGroup);
    socket.on("chat:group-deleted", onGroupDeleted);
    socket.on("chat:room-added", onRoomAdded);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:room-updated", onRoomUpdated);
      socket.off("chat:typing", onTyping);
      socket.off("chat:group-updated", onGroupUpdated);
      socket.off("chat:removed-from-group", onRemovedFromGroup);
      socket.off("chat:group-deleted", onGroupDeleted);
      socket.off("chat:room-added", onRoomAdded);
      disconnectChatSocket();
    };
  }, [token, me.kind, me.refId]);

  useEffect(() => {
    activeIdRef.current = activeId;
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadMessages(activeId);
    const socket = getChatSocket();
    socket?.emit("chat:join", activeId);
    return () => {
      socket?.emit("chat:leave", activeId);
    };
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!showNew) return;
    let cancelled = false;
    api.get("/chat/people", { params: { search: debouncedPeopleQ || undefined } })
      .then((res) => {
        if (!cancelled) setPeople({ employees: res.data.data?.employees || [] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showNew, debouncedPeopleQ]);

  const openRoom = (room) => {
    setActiveId(room._id);
    setReplyTo(null);
    setDraft("");
    setShowEmoji(false);
    setMobileShowChat(true);
    setShowInfo(false);
  };

  const appendLocalMessage = (msg) => {
    setMessages((prev) => (prev.some((row) => String(row._id) === String(msg._id)) ? prev : [...prev, msg]));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeId) return;
    const pendingReply = replyTo;

    setDraft("");
    setReplyTo(null);
    setShowEmoji(false);
    const socket = getChatSocket();
    if (socket?.connected) {
      socket.emit(
        "chat:send",
        { roomId: activeId, body, replyTo: pendingReply?._id || "" },
        (ack) => {
          if (!ack?.ok) toast.error(ack?.message || "Send failed");
        },
      );
      return;
    }
    try {
      const res = await api.post(`/chat/rooms/${activeId}/messages`, {
        body,
        replyTo: pendingReply?._id || undefined,
      });
      appendLocalMessage(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Send failed");
    }
  };

  const insertEmoji = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    if (!emoji) return;
    setDraft((prev) => `${prev}${emoji}`);
  };

  useEffect(() => {
    if (!showEmoji) return undefined;
    const onPointerDown = (event) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showEmoji]);

  const emitTyping = () => {
    getChatSocket()?.emit("chat:typing", { roomId: activeId, typing: true });
  };

  const startDm = async (person) => {
    try {
      setSaving(true);
      const res = await api.post("/chat/dm", { userId: person._id });
      const room = res.data.data;
      setRooms((prev) => {
        const without = prev.filter((row) => String(row._id) !== String(room._id));
        return [room, ...without];
      });
      setShowNew(false);
      openRoom(room);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not open chat");
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Enter group name");
      return;
    }
    if (!pickedEmployees.length) {
      toast.error("Add at least one member");
      return;
    }
    try {
      setSaving(true);
      const form = new FormData();
      form.append("name", groupName.trim());
      form.append("employees", JSON.stringify(pickedEmployees.map((row) => row._id)));
      if (groupAvatar) form.append("avatar", groupAvatar);
      const res = await api.post("/chat/groups", form);
      const room = res.data.data;
      setRooms((prev) => [room, ...prev]);
      setShowNew(false);
      setGroupName("");
      setPickedEmployees([]);
      setGroupAvatar(null);
      openRoom(room);
      toast.success("Group created");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create group");
    } finally {
      setSaving(false);
    }
  };

  const saveGroupInfo = async () => {
    if (!activeRoom || activeRoom.type !== "GROUP" || !activeRoom.canManage) return;
    try {
      setSaving(true);
      const form = new FormData();
      if (editName.trim()) form.append("name", editName.trim());
      if (editAvatar) form.append("avatar", editAvatar);
      form.append("employees", JSON.stringify(
        (activeRoom.members || []).filter((m) => m.kind === "USER" && String(m.refId) !== String(me.refId)).map((m) => m.refId),
      ));
      const res = await api.patch(`/chat/groups/${activeRoom._id}`, form);
      const room = res.data.data;
      setRooms((prev) => prev.map((row) => (String(row._id) === String(room._id) ? room : row)));
      setShowInfo(false);
      setEditAvatar(null);
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member) => {
    if (!activeRoom?.canManage) return;
    if (member.isAdmin) {
      toast.error("Cannot remove the group admin");
      return;
    }
    if (!window.confirm(`Remove ${member.name} from this group?`)) return;
    try {
      setSaving(true);
      const res = await api.post(`/chat/groups/${activeRoom._id}/remove-member`, {
        kind: member.kind,
        refId: member.refId,
      });
      const room = res.data.data;
      setRooms((prev) => prev.map((row) => (String(row._id) === String(room._id) ? room : row)));
      toast.success(`${member.name} removed`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove member");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!activeRoom?.canManage) return;
    if (!window.confirm(`Delete group "${activeRoom.name || activeRoom.title}"? All messages will be removed.`)) return;
    try {
      setSaving(true);
      await api.delete(`/chat/groups/${activeRoom._id}`);
      const goneId = activeRoom._id;
      setRooms((prev) => prev.filter((row) => String(row._id) !== String(goneId)));
      setActiveId("");
      setMessages([]);
      setShowInfo(false);
      setMobileShowChat(false);
      toast.success("Group deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete group");
    } finally {
      setSaving(false);
    }
  };

  const togglePick = (list, setList, person) => {
    setList((prev) => {
      if (prev.some((row) => String(row._id) === String(person._id))) {
        return prev.filter((row) => String(row._id) !== String(person._id));
      }
      return [...prev, person];
    });
  };

  const staff = me.kind === "USER" && canStartChats;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0b141a] text-slate-100">
      {/* Left: chat list */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-white/10 bg-[#111b21] md:w-[360px] md:max-w-[40%]",
          mobileShowChat ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={me.name} />
            <div>
              <p className="text-sm font-semibold text-white">Chats</p>
              <p className="text-xs text-slate-400">{me.name}</p>
            </div>
          </div>
          {staff && (
            <button
              type="button"
              onClick={() => { setShowNew(true); setNewTab("dm"); }}
              className="rounded-full p-2 text-[#00a884] hover:bg-white/5"
              title="New chat"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="border-b border-white/10 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="h-9 w-full rounded-lg bg-[#202c33] pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <p className="p-4 text-sm text-slate-500">Loading chats...</p>
          ) : rooms.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No chats yet{staff ? ". Tap + to start." : "."}
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room._id}
                type="button"
                onClick={() => openRoom(room)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5",
                  String(activeId) === String(room._id) && "bg-white/10",
                )}
              >
                <Avatar name={room.title} url={room.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">{room.title}</p>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatListTime(room.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {room.lastMessageSenderName ? `${room.lastMessageSenderName}: ` : ""}
                    {room.lastMessageText || (room.type === "GROUP" ? "Group" : "Say hello")}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: conversation */}
      <section
        className={cn(
          "relative flex min-w-0 flex-1 flex-col bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.03\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/svg%3E')] bg-[#0b141a]",
          !mobileShowChat ? "hidden md:flex" : "flex",
        )}
      >
        {!activeRoom ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
            <MessageCircle className="h-16 w-16 opacity-30" />
            <p className="text-lg font-medium text-slate-300">GNetCRM Chat</p>
            <p className="text-sm">Select a chat to start messaging</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 bg-[#202c33] px-3 py-2.5">
              <button type="button" className="rounded-full p-1.5 text-slate-300 md:hidden" onClick={() => setMobileShowChat(false)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => {
                if (activeRoom.type === "GROUP") {
                  setEditName(activeRoom.name || activeRoom.title || "");
                  setShowInfo(true);
                }
              }}>
                <Avatar name={activeRoom.title} url={activeRoom.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{activeRoom.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {typingName ? `${typingName} is typing...` : (
                      activeRoom.type === "GROUP"
                        ? `${activeRoom.members?.length || 0} members`
                        : "online"
                    )}
                  </p>
                </div>
              </button>
              {activeRoom.type === "GROUP" && (
                <button type="button" className="rounded-full p-2 text-slate-300 hover:bg-white/5" onClick={() => {
                  setEditName(activeRoom.name || activeRoom.title || "");
                  setShowInfo(true);
                }}>
                  <MoreVertical className="h-5 w-5" />
                </button>
              )}
            </header>

            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-8">
              {hasMore && (
                <div className="mb-2 flex justify-center">
                  <button
                    type="button"
                    className="rounded-full bg-[#202c33] px-3 py-1 text-xs text-slate-300"
                    onClick={() => loadMessages(activeId, { before: messages[0]?._id })}
                  >
                    Load earlier
                  </button>
                </div>
              )}
              {loadingMessages && !messages.length ? (
                <p className="text-center text-sm text-slate-500">Loading messages...</p>
              ) : null}
              {messages.map((msg) => {
                const mine = isMine(msg);
                return (
                  <div
                    key={msg._id}
                    className={cn("group flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "relative max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm sm:max-w-[65%]",
                        mine ? "rounded-tr-none bg-[#005c4b]" : "rounded-tl-none bg-[#202c33]",
                      )}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[11px] font-semibold text-[#53bdeb]">{msg.sender?.name}</p>
                      )}
                      {msg.replyTo?.messageId && (
                        <div className="mb-1 rounded border-l-2 border-[#53bdeb] bg-black/20 px-2 py-1">
                          <p className="text-[11px] font-semibold text-[#53bdeb]">{msg.replyTo.senderName}</p>
                          <p className="line-clamp-2 text-[11px] text-slate-300">{msg.replyTo.body}</p>
                        </div>
                      )}
                      {msg.body ? (
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-50">{msg.body}</p>
                      ) : null}
                      <div className="mt-0.5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded p-0.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-white"
                          title="Reply"
                          onClick={() => setReplyTo(msg)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-300/80">{formatBubbleTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {replyTo && (
              <div className="flex items-center gap-2 border-t border-white/10 bg-[#1d282f] px-3 py-2">
                <div className="min-w-0 flex-1 rounded border-l-2 border-[#00a884] bg-black/20 px-2 py-1">
                  <p className="text-[11px] font-semibold text-[#00a884]">Replying to {replyTo.sender?.name}</p>
                  <p className="truncate text-xs text-slate-300">{replyTo.body || "Message"}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <footer className="relative flex items-end gap-1.5 bg-[#202c33] px-2 py-2 sm:gap-2 sm:px-3">
              <div ref={emojiWrapRef} className="relative">
                {showEmoji && (
                  <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/10 shadow-2xl">
                    <EmojiPicker
                      theme={Theme.DARK}
                      emojiStyle={EmojiStyle.NATIVE}
                      width={320}
                      height={360}
                      searchPlaceholder="Search emoji"
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      lazyLoadEmojis
                      onEmojiClick={insertEmoji}
                    />
                  </div>
                )}
                <button
                  type="button"
                  title="Emoji"
                  onClick={() => setShowEmoji((open) => !open)}
                  className={cn("mb-0.5 rounded-full p-2 text-slate-300 hover:bg-white/5", showEmoji && "bg-white/10 text-[#00a884]")}
                >
                  <Smile className="h-5 w-5" />
                </button>
              </div>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  emitTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-lg bg-[#2a3942] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!draft.trim()}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </footer>
          </>
        )}
      </section>

      {/* New chat / group modal */}
      {showNew && staff && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="flex h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-[#111b21] sm:h-auto sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-white">{newTab === "dm" ? "New chat" : "New group"}</p>
              <button type="button" onClick={() => setShowNew(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex gap-2 border-b border-white/10 px-4 py-2">
              <button type="button" onClick={() => setNewTab("dm")} className={cn("rounded-full px-3 py-1 text-xs", newTab === "dm" ? "bg-[#00a884] text-white" : "bg-white/5 text-slate-300")}>Direct</button>
              <button type="button" onClick={() => setNewTab("group")} className={cn("rounded-full px-3 py-1 text-xs", newTab === "group" ? "bg-[#00a884] text-white" : "bg-white/5 text-slate-300")}>Group</button>
            </div>
            <div className="border-b border-white/10 px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={peopleQ}
                  onChange={(e) => setPeopleQ(e.target.value)}
                  placeholder="Search employees"
                  className="h-9 w-full rounded-lg bg-[#202c33] pl-9 pr-3 text-sm text-white outline-none"
                />
              </div>
            </div>

            {newTab === "group" && (
              <div className="space-y-3 border-b border-white/10 px-4 py-3">
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name"
                  className="border-white/10 bg-[#202c33] text-white"
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <Camera className="h-4 w-4 text-[#00a884]" />
                  {groupAvatar ? groupAvatar.name : "Set group photo (optional)"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setGroupAvatar(e.target.files?.[0] || null)} />
                </label>
                {pickedEmployees.length > 0 && (
                  <p className="text-xs text-slate-400">
                    Selected: {pickedEmployees.map((p) => p.name).join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-[#00a884]">Employees</p>
              {(people.employees || []).length === 0 ? (
                <p className="px-4 py-2 text-xs text-slate-500">No employees match</p>
              ) : people.employees.map((person) => {
                const selected = pickedEmployees.some((row) => String(row._id) === String(person._id));
                return (
                  <button
                    key={`u-${person._id}`}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                    onClick={() => {
                      if (newTab === "dm") startDm(person);
                      else togglePick(pickedEmployees, setPickedEmployees, person);
                    }}
                  >
                    <Avatar name={person.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{person.name}</p>
                      <p className="truncate text-xs text-slate-500">{person.code || "Employee"}</p>
                    </div>
                    {newTab === "group" && selected && <Check className="h-4 w-4 text-[#00a884]" />}
                  </button>
                );
              })}
            </div>

            {newTab === "group" && (
              <div className="border-t border-white/10 p-3">
                <Button className="w-full bg-[#00a884] hover:bg-[#019874]" onClick={createGroup} disabled={saving} isLoading={saving}>
                  <Users className="mr-2 h-4 w-4" />
                  Create group
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group info */}
      {showInfo && activeRoom?.type === "GROUP" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111b21] p-5">
            <div className="mb-4 flex items-start justify-between">
              <p className="font-semibold text-white">Group info</p>
              <button type="button" onClick={() => setShowInfo(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 flex flex-col items-center gap-2">
              <Avatar name={activeRoom.title} url={editAvatarPreview || activeRoom.avatarUrl} size="lg" />
              {activeRoom.canManage && (
                <label className="cursor-pointer text-xs text-[#00a884]">
                  Change photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditAvatar(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
            {activeRoom.canManage ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mb-3 border-white/10 bg-[#202c33] text-white"
                placeholder="Group name"
              />
            ) : (
              <p className="mb-3 text-center text-sm text-white">{activeRoom.name || activeRoom.title}</p>
            )}
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Members · {activeRoom.members?.length || 0}</p>
            <div className="mb-4 max-h-56 space-y-2 overflow-y-auto">
              {(activeRoom.members || []).map((member) => {
                const isMe = member.kind === me.kind && String(member.refId) === String(me.refId);
                return (
                  <div key={`${member.kind}-${member.refId}`} className="flex items-center gap-2">
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">
                        {member.name}{isMe ? " (You)" : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {member.isAdmin ? "Group admin" : "Staff"}
                        {member.code ? ` · ${member.code}` : ""}
                      </p>
                    </div>
                    {activeRoom.canManage && !member.isAdmin && !isMe && (
                      <button
                        type="button"
                        title="Remove from group"
                        disabled={saving}
                        onClick={() => removeMember(member)}
                        className="rounded-full p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {activeRoom.canManage && (
              <div className="space-y-2">
                <Button className="w-full bg-[#00a884]" onClick={saveGroupInfo} disabled={saving} isLoading={saving}>
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  onClick={deleteGroup}
                  disabled={saving}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete group
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
