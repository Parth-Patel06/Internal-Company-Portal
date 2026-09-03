import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as I from "lucide-react";
import { api, getToken } from "../api";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function initials(name = "User") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function Chat({ me }) {
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const selectedRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(selectedId)) || null,
    [conversations, selectedId]
  );
  selectedRef.current = selectedId;

  async function loadBase() {
    setLoading(true);
    setError("");
    try {
      const [userRows, conversationRows] = await Promise.all([
        api("/api/chat/users"),
        api("/api/chat/conversations"),
      ]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setConversations(Array.isArray(conversationRows) ? conversationRows : []);
      if (!selectedRef.current && conversationRows?.[0]) setSelectedId(conversationRows[0].id);
    } catch (err) {
      setError(err.message || "Unable to load Chat.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId) {
    if (!conversationId) return;
    setMessagesLoading(true);
    setError("");
    try {
      let rows = await api(`/api/chat/conversations/${conversationId}/messages`);
      rows = Array.isArray(rows) ? rows : [];

      // Backward compatibility: older messages may not have been linked to the
      // Phase 1 conversation_id even though the conversation list can still
      // show them as the latest message. If the conversation endpoint returns
      // nothing, load the legacy chat history and match the two participants.
      if (rows.length === 0) {
        const conversation = conversations.find(
          (item) => Number(item.id) === Number(conversationId)
        );

        if (conversation?.other_user_id) {
          const legacyRows = await api("/api/chat");
          const history = Array.isArray(legacyRows) ? legacyRows : [];
          rows = history
            .filter((message) => {
              const senderId = Number(message.sender_id);
              const receiverId = Number(message.receiver_id);
              const meId = Number(me.id);
              const otherId = Number(conversation.other_user_id);
              return (
                (senderId === meId && receiverId === otherId) ||
                (senderId === otherId && receiverId === meId)
              );
            })
            .sort((a, b) => {
              const first = new Date(a.created_at).getTime();
              const second = new Date(b.created_at).getTime();
              return first - second || Number(a.id) - Number(b.id);
            });
        }
      }

      setMessages(rows);
      await api(`/api/chat/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
      setConversations((current) => current.map((item) =>
        Number(item.id) === Number(conversationId) ? { ...item, unread_count: 0 } : item
      ));
    } catch (err) {
      setError(err.message || "Unable to load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedId);
    socketRef.current?.emit("chat:join", selectedId);
    return () => socketRef.current?.emit("chat:leave", selectedId);
  }, [selectedId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      if (selectedRef.current) socket.emit("chat:join", selectedRef.current);
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    socket.on("chat:message", (message) => {
      setConversations((current) => {
        const id = Number(message.conversation_id);
        const existing = current.find((item) => Number(item.id) === id);
        if (!existing) return current;
        const unread = Number(selectedRef.current) === id || Number(message.sender_id) === Number(me.id)
          ? 0
          : Number(existing.unread_count || 0) + 1;
        return [
          { ...existing, last_message_body: message.body, last_message_at: message.created_at, last_message_id: message.id, last_message_sender_id: message.sender_id, unread_count: unread },
          ...current.filter((item) => Number(item.id) !== id),
        ];
      });

      if (Number(selectedRef.current) === Number(message.conversation_id)) {
        setMessages((current) => current.some((item) => Number(item.id) === Number(message.id)) ? current : [...current, message]);
        api(`/api/chat/conversations/${message.conversation_id}/read`, { method: "POST" }).catch(() => {});
      }
    });

    socket.on("chat:deleted", ({ message_id, conversation_id }) => {
      if (Number(selectedRef.current) === Number(conversation_id)) {
        setMessages((current) => current.filter((item) => Number(item.id) !== Number(message_id)));
      }
      setConversations((current) => current.map((item) => Number(item.id) === Number(conversation_id) ? { ...item, last_message_body: "Message deleted", last_message_id: null } : item));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startConversation(user) {
    try {
      const result = await api("/api/chat/conversations", { method: "POST", body: { user_id: user.id } });
      setConversations((current) => current.some((item) => Number(item.id) === Number(result.id)) ? current : [result, ...current]);
      setSelectedId(result.id);
      socketRef.current?.emit("chat:join", result.id);
    } catch (err) {
      setError(err.message || "Unable to start conversation.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await api(`/api/chat/conversations/${selectedId}/messages`, { method: "POST", body: { body: text } });
      setMessages((current) => current.some((item) => Number(item.id) === Number(message.id)) ? current : [...current, message]);
      setConversations((current) => current.map((item) => Number(item.id) === Number(selectedId) ? { ...item, last_message_body: message.body, last_message_at: message.created_at, last_message_id: message.id, last_message_sender_id: message.sender_id } : item));
      setBody("");
    } catch (err) {
      setError(err.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  function requestDeleteMessage(message) {
    if (!canDelete) return;
    setError("");
    setNotice("");
    setDeleteTarget(message);
  }

  function cancelDeleteMessage() {
    setDeleteTarget(null);
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget || !canDelete) return;

    const messageId = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await api(`/api/chat/messages/${messageId}`, { method: "DELETE" });
      setMessages((current) => current.filter((item) => Number(item.id) !== Number(messageId)));
      setConversations((current) => current.map((item) =>
        Number(item.id) === Number(selectedId)
          ? { ...item, last_message_body: "Message deleted", last_message_id: null }
          : item
      ));
      setNotice("Message deleted successfully.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Unable to delete message.");
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    !normalizedSearch || `${user.full_name} ${user.employee_id} ${user.email}`.toLowerCase().includes(normalizedSearch)
  );
  const filteredConversations = conversations.filter((item) =>
    !normalizedSearch || `${item.other_user_name} ${item.other_employee_id} ${item.other_user_role}`.toLowerCase().includes(normalizedSearch)
  );
  const canDelete = ["CEO", "ADMIN"].includes(String(me.role || "").toUpperCase());

  return (
    <div className="chatShell">
      <aside className="chatSidebar">
        <div className="chatSidebarHead">
          <div>
            <h2>Chat</h2>
            <span>{socketConnected ? "Live" : "Connecting..."}</span>
          </div>
          <I.MessageCircle size={22} />
        </div>

        <div className="chatSearch">
          <I.Search size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees or chats" />
        </div>

        <div className="chatSectionLabel">Conversations</div>
        <div className="chatConversationList">
          {filteredConversations.map((item) => (
            <button key={item.id} className={`chatConversation ${Number(selectedId) === Number(item.id) ? "active" : ""}`} onClick={() => setSelectedId(item.id)}>
              <span className="chatAvatar">{initials(item.other_user_name)}</span>
              <span className="chatConversationText">
                <strong>{item.other_user_name}</strong>
                <small>{item.last_message_body || "Start a conversation"}</small>
              </span>
              <span className="chatConversationMeta">
                {item.last_message_at && <time>{formatTime(item.last_message_at)}</time>}
                {Number(item.unread_count) > 0 && <b>{item.unread_count}</b>}
              </span>
            </button>
          ))}
          {!loading && !filteredConversations.length && <div className="chatEmptySmall">No conversations yet.</div>}
        </div>

        <div className="chatSectionLabel">Employees</div>
        <div className="chatUserList">
          {filteredUsers.map((user) => (
            <button key={user.id} className="chatUserRow" onClick={() => startConversation(user)}>
              <span className="chatAvatar muted">{initials(user.full_name)}</span>
              <span><strong>{user.full_name}</strong><small>{user.employee_id} · {user.role}</small></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chatMain">
        {selectedConversation ? (
          <>
            <header className="chatHeader">
              <span className="chatAvatar">{initials(selectedConversation.other_user_name)}</span>
              <div><h3>{selectedConversation.other_user_name}</h3><small>{selectedConversation.other_employee_id} · {selectedConversation.other_user_role}</small></div>
            </header>

            {error && <div className="formMessage error chatError">{error}</div>}

            <div className="chatMessages">
              {messagesLoading ? <div className="chatLoading">Loading messages...</div> : messages.length === 0 ? <div className="chatWelcome"><I.MessageCircle size={40} /><h3>No messages yet</h3><p>Start the conversation with {selectedConversation.other_user_name}.</p></div> : messages.map((message, index) => {
                const own = Number(message.sender_id) === Number(me.id);
                const previous = messages[index - 1];
                const showDay = !previous || formatDay(previous.created_at) !== formatDay(message.created_at);
                return (
                  <React.Fragment key={message.id}>
                    {showDay && <div className="chatDayDivider"><span>{formatDay(message.created_at)}</span></div>}
                    <div className={`chatMessageRow ${own ? "own" : ""}`}>
                      <div className="chatBubble">
                        {!own && <strong>{message.sender_name}</strong>}
                        <div className="chatBody">{message.body}</div>
                        <div className="chatMessageMeta"><span>{formatTime(message.created_at)}</span>{own && <span>{message.read_at ? "Read" : "Sent"}</span>}{canDelete && <button title="Delete message" onClick={() => requestDeleteMessage(message)}><I.Trash2 size={13} /></button>}</div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form className="chatComposer" onSubmit={sendMessage}>
              <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Type a message..." disabled={sending} />
              <button className="primary" type="submit" disabled={!body.trim() || sending}><I.Send size={17} />{sending ? "Sending" : "Send"}</button>
            </form>
          </>
        ) : (
          <div className="chatNoSelection"><I.MessageCircle size={54} /><h2>Select an employee</h2><p>Choose an employee from the left to start an individual chat.</p></div>
        )}
      </section>

      {deleteTarget && (
        <div className="chatModalLayer" role="dialog" aria-modal="true" aria-labelledby="chatDeleteTitle">
          <div className="chatDeleteModal">
            <div className="chatDeleteIcon"><I.Trash2 size={20} /></div>
            <h3 id="chatDeleteTitle">Delete message?</h3>
            <p>
              This message will be removed from the normal chat view.
              Only Admin and CEO can perform this action.
            </p>
            <div className="chatDeletePreview">
              {deleteTarget.body || "This message"}
            </div>
            <div className="chatModalActions">
              <button type="button" className="chatCancelButton" onClick={cancelDeleteMessage}>
                Cancel
              </button>
              <button type="button" className="chatDeleteButton" onClick={confirmDeleteMessage}>
                <I.Trash2 size={15} />
                Delete message
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="chatPageNotice success" role="status">
          <I.CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
