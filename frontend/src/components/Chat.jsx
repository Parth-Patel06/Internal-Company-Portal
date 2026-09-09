import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as I from "lucide-react";
import { api, getToken, API_BASE } from "../api";
import { hasPermission } from "../utils/navigation";

const SOCKET_URL = API_BASE;

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

export default function Chat({ me, permissions }) {
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
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupMemberUserId, setGroupMemberUserId] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [chatMobile, setChatMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 900);
  const [mobileChatView, setMobileChatView] = useState("list");
  const [composerType, setComposerType] = useState("text");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setChatMobile(window.innerWidth <= 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!chatMobile) setMobileChatView("conversation");
  }, [chatMobile]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(selectedId)) || null,
    [conversations, selectedId]
  );
  selectedRef.current = selectedId;

  async function loadBase() {
    setLoading(true);
    setError("");

    // Load these independently. A failure in the conversation query must not
    // hide the employee directory or make the whole Chat page look empty.
    const [usersResult, conversationsResult] = await Promise.allSettled([
      api("/api/chat/users"),
      api("/api/chat/conversations"),
    ]);

    const userRows = usersResult.status === "fulfilled" && Array.isArray(usersResult.value)
      ? usersResult.value
      : [];
    const conversationRows = conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)
      ? conversationsResult.value
      : [];

    setUsers(userRows);
    setConversations(conversationRows);

    if (!selectedRef.current && conversationRows[0]) {
      setSelectedId(conversationRows[0].id);
    }

    const failures = [usersResult, conversationsResult].filter((result) => result.status === "rejected");
    if (failures.length) {
      const firstError = failures[0].reason;
      setError(firstError?.message || "Unable to load part of Chat.");
    }

    setLoading(false);
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
      setGroupInfo(null);
      if (chatMobile) setMobileChatView("list");
      return;
    }
    loadMessages(selectedId);
    const conversation = conversations.find((item) => Number(item.id) === Number(selectedId));
    if (conversation?.conversation_type === "group") {
      api(`/api/chat/groups/${selectedId}/members`)
        .then(setGroupInfo)
        .catch(() => setGroupInfo(null));
    } else {
      setGroupInfo(null);
      setGroupInfoOpen(false);
    }
    socketRef.current?.emit("chat:join", selectedId);
    return () => socketRef.current?.emit("chat:leave", selectedId);
  }, [selectedId, conversations.length]);

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

    socket.on("chat:conversation-created", () => {
      loadBase().catch(() => {});
    });

    socket.on("chat:member-removed", ({ conversation_id }) => {
      if (Number(selectedRef.current) === Number(conversation_id)) {
        setSelectedId(null);
        setMessages([]);
        setMobileChatView("list");
        setGroupInfo(null);
        setGroupInfoOpen(false);
      }
      loadBase().catch(() => {});
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
      setMobileChatView("conversation");
      socketRef.current?.emit("chat:join", result.id);
    } catch (err) {
      setError(err.message || "Unable to start conversation.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedId || sending || uploading || recording) return;

    const text = body.trim();
    if ((composerType === "text" || composerType === "code") && !text) return;

    setSending(true);
    setError("");
    try {
      const message = await api(`/api/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: {
          body: text || null,
          message_type: composerType
        }
      });
      setMessages((current) => current.some((item) => Number(item.id) === Number(message.id)) ? current : [...current, message]);
      setConversations((current) => current.map((item) => Number(item.id) === Number(selectedId)
        ? { ...item, last_message_body: composerType === "code" ? "Code snippet" : message.body, last_message_at: message.created_at, last_message_id: message.id, last_message_sender_id: message.sender_id }
        : item
      ));
      setBody("");
      setComposerType("text");
    } catch (err) {
      setError(err.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function uploadAttachment(file, typeOverride = "file") {
    if (!selectedId || !file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);

      const uploaded = await api("/api/chat/uploads", {
        method: "POST",
        body: form
      });

      const message = await api(`/api/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: {
          body: typeOverride === "voice" ? "Voice message" : null,
          message_type: typeOverride,
          attachment_url: uploaded.url,
          attachment_name: uploaded.name,
          attachment_mime: uploaded.mime,
          attachment_size: uploaded.size
        }
      });

      setMessages((current) => current.some((item) => Number(item.id) === Number(message.id)) ? current : [...current, message]);
      setConversations((current) => current.map((item) => Number(item.id) === Number(selectedId)
        ? { ...item, last_message_body: typeOverride === "voice" ? "Voice message" : uploaded.name, last_message_at: message.created_at, last_message_id: message.id, last_message_sender_id: message.sender_id }
        : item
      ));
      setNotice(typeOverride === "voice" ? "Voice message sent." : "File sent.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Unable to send attachment.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadAttachment(file, "file");
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-message-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" });
        await uploadAttachment(file, "voice");
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setError("Voice recording failed.");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(err.message || "Microphone access was denied.");
      setRecording(false);
    }
  }

  function toggleGroupMember(userId) {
    const id = Number(userId);
    setSelectedMembers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function createGroup(event) {
    event.preventDefault();
    if (!groupName.trim() || !selectedMembers.length || groupBusy) return;

    setGroupBusy(true);
    setError("");
    try {
      const result = await api("/api/chat/groups", {
        method: "POST",
        body: { name: groupName.trim(), member_ids: selectedMembers }
      });

      setConversations((current) => [
        result,
        ...current.filter((item) => Number(item.id) !== Number(result.id))
      ]);
      setSelectedId(result.id);
      setGroupName("");
      setSelectedMembers([]);
      setGroupModalOpen(false);
      setNotice("Group created successfully.");
      window.setTimeout(() => setNotice(""), 3000);
      socketRef.current?.emit("chat:join", result.id);
    } catch (err) {
      setError(err.message || "Unable to create group.");
    } finally {
      setGroupBusy(false);
    }
  }

  async function addGroupMember() {
    if (!selectedId || !groupMemberUserId || groupBusy) return;
    setGroupBusy(true);
    setError("");
    try {
      await api(`/api/chat/groups/${selectedId}/members`, {
        method: "POST",
        body: { user_id: Number(groupMemberUserId) }
      });
      setGroupInfo(await api(`/api/chat/groups/${selectedId}/members`));
      setGroupMemberUserId("");
      setNotice("Member added successfully.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Unable to add member.");
    } finally {
      setGroupBusy(false);
    }
  }

  async function removeGroupMember(userId) {
    if (!selectedId || groupBusy) return;
    setGroupBusy(true);
    setError("");
    try {
      await api(`/api/chat/groups/${selectedId}/members/${userId}`, { method: "DELETE" });
      setGroupInfo(await api(`/api/chat/groups/${selectedId}/members`));
      setNotice("Member removed successfully.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Unable to remove member.");
    } finally {
      setGroupBusy(false);
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
  const canDelete = hasPermission(permissions, "chat.delete_own");

  return (
    <div className={`chatShell ${chatMobile ? "chatMobile" : ""} ${mobileChatView === "conversation" ? "chatConversationView" : "chatListView"}`}>
      <aside className="chatSidebar">
        <div className="chatSidebarHead">
          <div>
            <h2>Chat</h2>
            <span>{socketConnected ? "Live" : "Connecting..."}</span>
          </div>
          <button
            type="button"
            className="chatNewGroupButton"
            onClick={() => setGroupModalOpen(true)}
            title="Create group"
          >
            <I.UsersRound size={17} />
            <span>Group</span>
          </button>
        </div>

        <div className="chatSearch">
          <I.Search size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees or chats" />
        </div>

        <div className="chatSectionLabel">Conversations</div>
        <div className="chatConversationList">
          {filteredConversations.map((item) => (
            <button key={item.id} className={`chatConversation ${Number(selectedId) === Number(item.id) ? "active" : ""}`} onClick={() => { setSelectedId(item.id); setMobileChatView("conversation"); }}>
              <span className={`chatAvatar ${item.conversation_type === "group" ? "group" : ""}`}>
                {item.conversation_type === "group" ? <I.UsersRound size={17} /> : initials(item.other_user_name)}
              </span>
              <span className="chatConversationText">
                <strong>{item.other_user_name}</strong>
                <small>
                  {item.conversation_type === "group"
                    ? `${item.member_count || 0} members`
                    : (item.last_message_body || "Start a conversation")}
                </small>
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
              <button
                type="button"
                className="chatMobileBack"
                onClick={() => setMobileChatView("list")}
                aria-label="Back to conversations"
                title="Back to conversations"
              >
                <I.ArrowLeft size={18} />
              </button>
              <span className={`chatAvatar ${selectedConversation.conversation_type === "group" ? "group" : ""}`}>
                {selectedConversation.conversation_type === "group"
                  ? <I.UsersRound size={18} />
                  : initials(selectedConversation.other_user_name)}
              </span>
              <div className="chatHeaderIdentity">
                <h3>{selectedConversation.other_user_name}</h3>
                <small>
                  {selectedConversation.conversation_type === "group"
                    ? `${selectedConversation.member_count || 0} members`
                    : `${selectedConversation.other_employee_id} · ${selectedConversation.other_user_role}`}
                </small>
              </div>
              {selectedConversation.conversation_type === "group" && (
                <button type="button" className="chatGroupInfoButton" onClick={() => setGroupInfoOpen(true)}>
                  <I.UsersRound size={17} />
                  <span>Members</span>
                </button>
              )}
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
                        {message.message_type === "code" ? (
                          <pre className="chatCodeBlock"><code>{message.body || ""}</code></pre>
                        ) : message.message_type === "file" ? (
                          <a className="chatAttachment" href={`${SOCKET_URL}${message.attachment_url || ""}`} target="_blank" rel="noreferrer">
                            <I.Paperclip size={16} />
                            <span><strong>{message.attachment_name || "Attachment"}</strong><small>{message.attachment_mime || "File"}</small></span>
                          </a>
                        ) : message.message_type === "voice" ? (
                          <div className="chatVoiceMessage">
                            <I.Mic size={16} />
                            <audio controls preload="metadata" src={`${SOCKET_URL}${message.attachment_url || ""}`} />
                          </div>
                        ) : (
                          <div className="chatBody">{message.body}</div>
                        )}
                        <div className="chatMessageMeta"><span>{formatTime(message.created_at)}</span>{own && <span>{message.read_at ? "Read" : "Sent"}</span>}{canDelete && <button title="Delete message" onClick={() => requestDeleteMessage(message)}><I.Trash2 size={13} /></button>}</div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form className="chatComposer" onSubmit={sendMessage}>
              <div className="chatComposerTools">
                <select value={composerType} onChange={(e) => setComposerType(e.target.value)} disabled={sending || uploading || recording} aria-label="Message type">
                  <option value="text">Text</option>
                  <option value="code">Code snippet</option>
                </select>
                <input ref={fileInputRef} type="file" className="chatHiddenFileInput" onChange={handleFileSelected} />
                <button type="button" className="chatComposerIconButton" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading || recording} title="Attach file">
                  <I.Paperclip size={17} />
                </button>
                <button type="button" className={`chatComposerIconButton ${recording ? "recording" : ""}`} onClick={toggleRecording} disabled={sending || uploading} title={recording ? "Stop recording" : "Record voice message"}>
                  <I.Mic size={17} />
                </button>
              </div>
              {composerType === "code" ? (
                <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Paste or type code..." disabled={sending || uploading || recording} rows={3} />
              ) : (
                <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder={recording ? "Recording voice message..." : "Type a message..."} disabled={sending || uploading || recording} />
              )}
              <button className="primary" type="submit" disabled={!body.trim() || sending || uploading || recording}>
                <I.Send size={17} />{sending ? "Sending" : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="chatNoSelection"><I.MessageCircle size={54} /><h2>Select an employee</h2><p>Choose an employee from the left or create a group to start chatting.</p></div>
        )}
      </section>

      {groupModalOpen && (
        <div className="chatModalLayer" role="dialog" aria-modal="true" aria-labelledby="chatGroupTitle">
          <div className="chatGroupModal">
            <div className="chatModalHeader">
              <div>
                <h3 id="chatGroupTitle">Create group</h3>
                <p>Choose the employees who should be part of this conversation.</p>
              </div>
              <button type="button" className="chatModalClose" onClick={() => setGroupModalOpen(false)}>
                <I.X size={18} />
              </button>
            </div>

            <label className="chatFieldLabel">Group name</label>
            <input
              className="chatModalInput"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Project Alpha"
            />

            <label className="chatFieldLabel">Members ({selectedMembers.length})</label>
            <div className="chatGroupMemberPicker">
              {users.map((user) => (
                <label key={user.id} className={`chatMemberPickerRow ${selectedMembers.includes(Number(user.id)) ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(Number(user.id))}
                    onChange={() => toggleGroupMember(user.id)}
                  />
                  <span className="chatAvatar muted">{initials(user.full_name)}</span>
                  <span>
                    <strong>{user.full_name}</strong>
                    <small>{user.employee_id} · {user.role}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="chatModalActions">
              <button type="button" className="chatCancelButton" onClick={() => setGroupModalOpen(false)}>Cancel</button>
              <button type="button" className="chatPrimaryButton" disabled={!groupName.trim() || !selectedMembers.length || groupBusy} onClick={createGroup}>
                <I.UsersRound size={15} />
                {groupBusy ? "Creating..." : "Create group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupInfoOpen && selectedConversation?.conversation_type === "group" && groupInfo && (
        <div className="chatModalLayer" role="dialog" aria-modal="true" aria-labelledby="chatMembersTitle">
          <div className="chatGroupModal">
            <div className="chatModalHeader">
              <div>
                <h3 id="chatMembersTitle">{groupInfo.group?.name || "Group members"}</h3>
                <p>{groupInfo.members?.length || 0} members</p>
              </div>
              <button type="button" className="chatModalClose" onClick={() => setGroupInfoOpen(false)}>
                <I.X size={18} />
              </button>
            </div>

            {(hasPermission(permissions, "chat.manage_group") ||
              Number(groupInfo.group?.created_by) === Number(me.id) ||
              groupInfo.members?.some((member) => Number(member.id) === Number(me.id) && member.is_admin)) && (
              <div className="chatAddMemberRow">
                <select value={groupMemberUserId} onChange={(e) => setGroupMemberUserId(e.target.value)}>
                  <option value="">Add an employee...</option>
                  {users
                    .filter((user) => !groupInfo.members?.some((member) => Number(member.id) === Number(user.id)))
                    .map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.employee_id}</option>)}
                </select>
                <button type="button" className="chatPrimaryButton" disabled={!groupMemberUserId || groupBusy} onClick={addGroupMember}>Add</button>
              </div>
            )}

            <div className="chatGroupMemberList">
              {groupInfo.members?.map((member) => {
                const canManageMembers =
                  hasPermission(permissions, "chat.manage_group") ||
                  Number(groupInfo.group?.created_by) === Number(me.id) ||
                  groupInfo.members?.some((m) => Number(m.id) === Number(me.id) && m.is_admin);

                const canRemove = canManageMembers &&
                  Number(member.id) !== Number(groupInfo.group?.created_by) &&
                  Number(member.id) !== Number(me.id);

                return (
                  <div className="chatGroupMemberRow" key={member.id}>
                    <span className="chatAvatar muted">{initials(member.full_name)}</span>
                    <span className="chatGroupMemberText">
                      <strong>{member.full_name}</strong>
                      <small>{member.employee_id} · {member.role}{member.is_admin ? " · Group admin" : ""}</small>
                    </span>
                    {canRemove && (
                      <button type="button" className="chatMemberRemove" onClick={() => removeGroupMember(member.id)} disabled={groupBusy}>Remove</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
