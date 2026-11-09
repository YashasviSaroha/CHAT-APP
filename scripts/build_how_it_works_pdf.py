"""Build docs/QuickChat-How-It-Works.pdf from the current app."""

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    NextPageTemplate,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    ListFlowable,
    ListItem,
    HRFlowable,
    Preformatted,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "QuickChat-How-It-Works.pdf"

INK = HexColor("#1B2430")
TEAL = HexColor("#5B4B8A")
TEAL_SOFT = HexColor("#F3F0FA")
SAND = HexColor("#F7F5FB")
RULE = HexColor("#D9D3E8")
MUTED = HexColor("#5C6570")
CODE_BG = HexColor("#F4F1EA")

pdfmetrics.registerFont(TTFont("Calibri", r"C:\Windows\Fonts\calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", r"C:\Windows\Fonts\calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", r"C:\Windows\Fonts\calibrii.ttf"))
pdfmetrics.registerFont(TTFont("Consolas", r"C:\Windows\Fonts\consola.ttf"))


def S(name, **kwargs):
    base = dict(fontName="Calibri", fontSize=11, leading=15, textColor=INK, alignment=TA_JUSTIFY)
    base.update(kwargs)
    return ParagraphStyle(name, **base)


STYLES = {
    "h1": S("h1", fontName="Calibri-Bold", fontSize=16, leading=20, textColor=TEAL, spaceBefore=8, spaceAfter=6, alignment=TA_LEFT),
    "h2": S("h2", fontName="Calibri-Bold", fontSize=13, leading=17, textColor=INK, spaceBefore=10, spaceAfter=4, alignment=TA_LEFT),
    "body": S("body", spaceAfter=8),
    "small": S("small", fontSize=9.5, leading=13, textColor=MUTED, spaceAfter=6),
    "bullet": S("bullet", fontSize=11, leading=14.5, alignment=TA_LEFT),
    "cover_kicker": S("cover_kicker", fontSize=11, leading=14, textColor=HexColor("#D7CCEF"), alignment=TA_LEFT),
    "cover_title": S("cover_title", fontName="Calibri-Bold", fontSize=32, leading=36, textColor=white, alignment=TA_LEFT),
    "cover_sub": S("cover_sub", fontSize=13, leading=18, textColor=HexColor("#E7E2F4"), alignment=TA_LEFT),
    "toc_item": S("toc_item", fontSize=11, leading=16, alignment=TA_LEFT),
    "th": S("th", fontName="Calibri-Bold", fontSize=9, leading=12, textColor=white, alignment=TA_LEFT),
    "td": S("td", fontSize=9, leading=12, alignment=TA_LEFT),
    "caption": S("caption", fontName="Calibri-Italic", fontSize=9, leading=12, textColor=MUTED, alignment=TA_LEFT, spaceBefore=2, spaceAfter=8),
    "callout": S("callout", fontSize=10.5, leading=14.5, alignment=TA_LEFT),
    "code": ParagraphStyle("code", fontName="Consolas", fontSize=8.5, leading=11.5, textColor=INK),
}


def P(text, style="body"):
    return Paragraph(text, STYLES[style])


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(item, STYLES["bullet"]), leftIndent=12, bulletColor=TEAL) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=14,
        bulletFontName="Calibri",
        bulletFontSize=8,
        spaceBefore=2,
        spaceAfter=8,
    )


def heading(text):
    return KeepTogether([Spacer(1, 2), P(text, "h2")])


def with_table(title, tbl, caption):
    return KeepTogether([Spacer(1, 2), P(title, "h2"), tbl, P(caption, "caption")])


def keep_head(title, *rest):
    return KeepTogether([Spacer(1, 2), P(title, "h2"), *rest])


def table(headers, rows, col_widths):
    data = [[P(cell, "th") for cell in headers]]
    for row in rows:
        data.append([P(cell, "td") for cell in row])
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("BACKGROUND", (0, 1), (-1, -1), SAND),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SAND]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE),
    ]))
    return tbl


def callout(text):
    inner = Table([[P(text, "callout")]], colWidths=[170 * mm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (0, 0), (0, -1), 3, TEAL),
    ]))
    return KeepTogether([Spacer(1, 2), inner, Spacer(1, 8)])


def code_table(text):
    block = Table([[Preformatted(text, STYLES["code"])]], colWidths=[170 * mm])
    block.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return block


def code_block(text):
    return KeepTogether([code_table(text), Spacer(1, 8)])


def flow_strip():
    labels = ["Sign in", "Connect", "Write", "Deliver", "Expire"]
    cells = [P(f"<font color='white'><b>{label}</b></font>", "td") for label in labels]
    col = 174 * mm / len(labels)
    tbl = Table([cells], colWidths=[col] * len(labels))
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEAFTER", (0, 0), (-2, -1), 0.6, white),
    ]))
    return KeepTogether([tbl, P("Figure 1. The path from an account to a message that later disappears.", "caption")])


def draw_cover(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(INK)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, 0, 8 * mm, height, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#2A2340"))
    canvas.rect(0, 0, width, 42 * mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(18 * mm, 42 * mm, 46 * mm, 1.2, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#E4DFF3"))
    canvas.setFont("Calibri", 9)
    canvas.drawString(18 * mm, 24 * mm, "QuickChat  ·  Private real-time messaging")
    canvas.drawString(18 * mm, 16 * mm, "Browser title QuickChat  ·  Local app at http://localhost:5173")
    canvas.restoreState()


def draw_body(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(TEAL)
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Calibri", 8.5)
    canvas.drawString(18 * mm, height - 7.6 * mm, "QuickChat")
    canvas.drawRightString(width - 18 * mm, height - 7.6 * mm, "How the app works")
    canvas.setFillColor(RULE)
    canvas.rect(18 * mm, 12 * mm, width - 36 * mm, 0.4, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Calibri", 8.5)
    canvas.drawString(18 * mm, 7 * mm, "Technical and non-technical guide")
    canvas.drawRightString(width - 18 * mm, 7 * mm, str(doc.page))
    canvas.restoreState()


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title="QuickChat — How the app works",
        author="QuickChat",
        subject="Technical and non-technical explanation of QuickChat, including how to start it",
    )
    frame_cover = Frame(18 * mm, 52 * mm, A4[0] - 36 * mm, 150 * mm, id="cover", showBoundary=0)
    frame_body = Frame(18 * mm, 18 * mm, A4[0] - 36 * mm, A4[1] - 36 * mm, id="body", showBoundary=0)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame_cover], onPage=draw_cover),
        PageTemplate(id="body", frames=[frame_body], onPage=draw_body),
    ])

    story = []
    story.append(Spacer(1, 28 * mm))
    story.append(P("PRODUCT GUIDE", "cover_kicker"))
    story.append(Spacer(1, 4 * mm))
    story.append(P("How QuickChat works", "cover_title"))
    story.append(Spacer(1, 4 * mm))
    story.append(P("One explanation for a reader who wants the idea, and one for a reader who wants the code path. The last section is the exact way to start the app.", "cover_sub"))
    story.append(Spacer(1, 8 * mm))
    story.append(P("9 November 2026", "cover_sub"))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    story.append(P("Contents", "h1"))
    story.append(HRFlowable(width="100%", thickness=0.6, color=TEAL, spaceAfter=8))
    story.append(P("<b>Part I. The app in plain language</b>", "toc_item"))
    for line in [
        "1. What QuickChat is for",
        "2. The words on the screen",
        "3. A conversation from start to finish",
        "4. What each screen is for",
        "5. Messages that disappear",
        "6. Saved messages, edits, and deletion",
        "7. Finding someone, and the QR code",
    ]:
        story.append(P(line, "toc_item"))
    story.append(Spacer(1, 4))
    story.append(P("<b>Part II. The app in the code</b>", "toc_item"))
    for line in [
        "8. Shape of the application",
        "9. Sign-in and sessions",
        "10. From the send button to the other person",
        "11. Where each kind of data lives",
        "12. Expiry, bookmarks, and cleanup",
        "13. Rooms, presence, and more than one device",
        "14. Summaries, Catch Me Up, and voice notes",
        "15. Blocks and reports",
    ]:
        story.append(P(line, "toc_item"))
    story.append(Spacer(1, 4))
    story.append(P("<b>Part III. How to start everything</b>", "toc_item"))
    for line in [
        "16. What to prepare",
        "17. Terminal 1: the API",
        "18. Terminal 2: the website",
        "19. What still opens if a service is missing",
    ]:
        story.append(P(line, "toc_item"))
    story.append(Spacer(1, 8))
    story.append(callout("The name on the screen and in the browser tab is QuickChat. The project folder is CHAT-APP. The longer README file uses the name Nexus for the same application."))

    story.append(P("Part I. The app in plain language", "h1"))
    story.append(HRFlowable(width="100%", thickness=0.6, color=TEAL, spaceAfter=8))

    story.append(heading("1. What QuickChat is for"))
    story.append(P("QuickChat is a private messenger. A person creates an account, connects with specific people, and exchanges text, photos, and voice notes. There is no public room where every user can read every message."))
    story.append(P("A new message is kept for a limited time. The usual period is 24 hours. A conversation can use 12 hours or 7 days instead. When that time ends, the message leaves the conversation. A person can bookmark one message for themselves. That personal copy stays in Saved Messages after the conversation copy is gone."))
    story.append(flow_strip())

    story.append(with_table(
        "2. The words on the screen",
        table(
            ["Word", "Meaning"],
            [
                ["Contact", "Someone you can already message. Older connections stay in this list."],
                ["Request", "An invitation to connect. The other person accepts or declines. A new person is not added instantly."],
                ["Group", "A named chat with you and at least two contacts."],
                ["Username", "The exact name other people type to find you. It can be hidden from search."],
                ["Saved message", "Your private bookmark. It is not shared with the other person."],
                ["Session", "One signed-in browser. You can end a session from the Sessions screen."],
            ],
            [34 * mm, 140 * mm],
        ),
        "Table 1. Words used in the sidebar and settings.",
    ))

    story.append(heading("3. A conversation from start to finish"))
    story.append(bullets([
        "<b>Create an account.</b> The form asks for a name, email, password, and a short bio. A username is optional at signup and can be added later on the profile page.",
        "<b>Find a person.</b> Type their exact username. If they allow discovery, you see their name, username, and photo, then send a request.",
        "<b>Wait for acceptance.</b> The request appears on their sidebar. Accept adds both people as contacts. Decline does not.",
        "<b>Send a message.</b> Text goes immediately. A photo or voice note is uploaded first, then the chat sends the address of that file.",
        "<b>Read the ticks.</b> One tick means the server accepted it. Two grey ticks mean it reached the other browser. Two blue ticks mean it was read.",
        "<b>Leave it, or keep it.</b> The message disappears after the conversation’s retention time. The star on a bubble keeps a copy only for you.",
    ]))

    story.append(heading("4. What each screen is for"))
    story.append(table(
        ["Screen", "What you do there"],
        [
            ["Login", "Create an account or sign in. The browser tab title is QuickChat."],
            ["Home", "See contacts, groups, and requests. Open a thread. Send text, a photo, or a voice note."],
            ["Profile", "Change your name, bio, photo, username, and whether that username can be found."],
            ["Saved Messages", "Read bookmarks that remain after a conversation expires."],
            ["Share Profile", "Create a QR code, watch the 10-minute countdown, revoke it, or paste someone else’s code."],
            ["Sessions", "See signed-in devices and log one of them out. The secret token is not shown."],
            ["Settings", "Turn sound, desktop alerts, mention alerts, and username search on or off."],
            ["Reports", "Visible only for email addresses listed in ADMIN_EMAILS."],
        ],
        [36 * mm, 138 * mm],
    ))
    story.append(P("Table 2. Routes in the React app.", "caption"))

    story.append(keep_head(
        "5. Messages that disappear",
        P("The header of an open chat says how long new messages last. Changing 12 hours, 24 hours, or 7 days applies to messages created after the change. Messages already sent keep the expiry they were given."),
    ))
    story.append(P("Disappearing is controlled by the server. Hiding a row in the browser is not enough. A cleanup task deletes expired messages. Opening the app on another device does not bring an expired message back into the thread."))
    story.append(P("Messages that were stored only in one browser before this behavior was added stay on that browser. They are not copied up to the server."))

    story.append(heading("6. Saved messages, edits, and deletion"))
    story.append(bullets([
        "<b>Bookmark.</b> The small star sits at the corner of a bubble. Your bookmark does not preserve the message for the other person.",
        "<b>Edit.</b> You can edit your own text for 15 minutes. The bubble then shows Edited.",
        "<b>Delete for me.</b> The message leaves your thread. A bookmark you already made stays in Saved Messages.",
        "<b>Delete for everyone.</b> Available for 60 minutes. It removes the message for the people in the chat, removes saved copies, and removes the uploaded file.",
        "<b>Reply.</b> A reply shows a short quote of the earlier message above the new one.",
    ]))

    story.append(heading("7. Finding someone, and the QR code"))
    story.append(P("Username search matches the whole username, not a fragment of an email. If discovery is turned off, that search returns no profile."))
    story.append(P("Share Profile creates a QR code that lasts 10 minutes and can be used once. The picture contains a random token. It does not contain a password, a database id, or a login token. You can revoke the code before anyone uses it. Creating a new code revokes the previous unused one. The other person pastes the token, or scans it when the browser can read QR codes, and you become contacts."))

    story.append(P("Part II. The app in the code", "h1"))
    story.append(HRFlowable(width="100%", thickness=0.6, color=TEAL, spaceAfter=8))

    story.append(heading("8. Shape of the application"))
    story.append(P("QuickChat is two programs. The client is Vite, React 19, and Tailwind 4. The server is Express 5 with Socket.IO. The page shell is client/src/App.jsx. Sign-in state lives in client/context/AuthContext.jsx. Chat state lives in client/context/ChatContext.jsx."))
    story.append(KeepTogether([
        table(
            ["Piece", "Role"],
            [
                ["client/src/pages and components", "Login, home, profile, saved messages, QR, sessions, settings, and reports."],
                ["client/context/ChatContext.jsx", "Contacts, requests, sending, IndexedDB cache, and socket events."],
                ["server/server.js", "HTTP server, Socket.IO, route mounting, and the listen step."],
                ["server/services/messages.js", "Save, edit, delete, search, bookmarks, history, and expiry cleanup."],
                ["server/socket/register.js", "Authenticated sockets, rooms, delivery, and read receipts."],
                ["server/models", "Mongoose models for users, conversations, messages, bookmarks, and requests."],
            ],
            [58 * mm, 116 * mm],
        ),
        P("Table 3. Where the main behavior lives.", "caption"),
    ]))

    story.append(heading("9. Sign-in and sessions"))
    story.append(P("Signup and login hash the password with bcrypt and return a JWT. The token travels in a header named token. New tokens expire after 30 days and carry a session id. The password hash is not included in the response."))
    story.append(P("If MySQL is configured, each login inserts a row in device_sessions. The database stores a hash of the session id, a device label, and the last active time. It does not store the raw token. Ending a session sets revoked_at. The next API call and the next socket connection reject that token. Tokens created before sessions existed still work until the person logs in again."))

    story.append(heading("10. From the send button to the other person"))
    story.append(P("The browser creates a message id, shows the message at once, and stores it in IndexedDB under the name QuickChatDB. It then emits send_message. The server checks the JWT, checks that the sender may message that person, and writes the message to MongoDB before acknowledging it."))
    story.append(P("A repeated send with the same message id does not create a second row. If the socket is down, the browser keeps the payload in an outbox and sends it when the connection returns. A recipient who is offline receives waiting messages from MongoDB on the next connection."))
    story.append(P("Photos and voice notes go to Cloudinary first through POST /api/messages/upload. The socket message carries the file address and a public id, not the raw recording. Text longer than 10,000 characters is rejected. The send rate is limited."))

    story.append(heading("11. Where each kind of data lives"))
    story.append(table(
            ["Data", "Owner"],
            [
                ["Account, username, contacts, blocks, notification settings", "MongoDB collection users"],
                ["Direct chats and groups, retention, mute", "MongoDB collection conversations"],
                ["Messages, edits, expiry, read receipts", "MongoDB collection messages"],
                ["Personal bookmarks", "MongoDB collection savedmessages"],
                ["Connection requests", "MongoDB collection connectionrequests"],
                ["QR tokens", "MySQL table qr_invite_tokens"],
                ["Device sessions", "MySQL table device_sessions"],
                ["Abuse reports", "MySQL table abuse_reports"],
                ["Images and voice files", "Cloudinary"],
                ["A local cache, plus older browser-only messages", "IndexedDB database QuickChatDB"],
            ],
            [78 * mm, 96 * mm],
    ))
    story.append(P("Table 4. One owner for each kind of data. MongoDB and MySQL are not updated as a single transaction.", "caption"))
    story.append(P("A QR redeem checks the token, adds the two users as contacts, and only then marks the token used. If the contact update fails, the token can be tried again. Adding the same contact twice does not create a duplicate."))

    story.append(heading("12. Expiry, bookmarks, and cleanup"))
    story.append(P("createMessage sets expiresAt from the conversation retention: 12, 24, or 168 hours. History, search, summaries, and pending delivery all skip messages whose expiry has passed and messages deleted for that user."))
    story.append(P("Bookmark writes a SavedMessage immediately. Cleanup runs about once a minute. It copies any bookmarked content that is missing, then deletes the live message. A Cloudinary file is removed when no saved copy still points at it. Delete for everyone deletes saved copies first, then the file, then leaves a short tombstone so other open devices drop their local copy."))
    story.append(P("Without REDIS_URL, server/jobs/scheduler.js runs that cleanup on a timer inside the API process. With Redis, the same cleanup can run through BullMQ. Either way the delete is safe to repeat."))

    story.append(heading("13. Rooms, presence, and more than one device"))
    story.append(P("A socket must present the same JWT. After that it joins user:{userId}. It joins conversation:{conversationId} only when that user is a member. A client cannot ask to join an arbitrary room and receive it."))
    story.append(P("Presence is a set of socket ids for each user. Disconnecting one browser removes only that socket. Online and offline on the contact list follows whether any socket for that person remains. Delivery of a new message goes to each member’s user room, so a second signed-in device still receives it."))

    story.append(keep_head(
        "14. Summaries, Catch Me Up, and voice notes",
        P("Summarize and Catch Me Up are POST /api/ai/summarize and POST /api/ai/catch-up. The server loads only messages in that conversation that the caller can still see. The choices are the last hour, the last 24 hours, messages the user selected, or a custom time range. The request tells the screen that those messages are sent to Google Gemini. The summary is stored only when the user presses Save."),
    ))
    story.append(P("A voice note is saved first. Transcription is queued afterward. The bubble shows processing, completed, failed, or unavailable. The transcript can be copied. It is included in search only after the sender turns that on. GEMINI_API_KEY stays on the server. There is no VITE_ copy of it. If the key is absent, chat and voice notes still send, and the transcript status is unavailable."))

    story.append(keep_head(
        "15. Blocks and reports",
        P("Blocking adds the other person to blockedUsers. New messages in both directions stop. The blocked person sees that messaging is unavailable, without a statement of who blocked whom. Unblock removes that entry."),
    ))
    story.append(P("A report has a fixed reason: spam, harassment, inappropriate, scam, or other. The same person cannot file the same report twice. Message text is copied into the report only when the reporter checks the evidence box. GET /api/reports is limited to addresses in ADMIN_EMAILS."))

    story.append(P("Part III. How to start everything", "h1"))
    story.append(HRFlowable(width="100%", thickness=0.6, color=TEAL, spaceAfter=8))

    story.append(heading("16. What to prepare"))
    story.append(P("Use two terminals. Leave both running. Node.js 18.18 or newer is required. Do this from the CHAT-APP folder. If server\\.env and client\\.env already exist, do not replace them."))
    story.append(P("Chat requires MongoDB through MONGODB_URI, a JWT_SECRET, and the Cloudinary variables already used for photos. The client needs VITE_BACKEND_URL=http://localhost:5000. MySQL, Gemini, and Redis are additional. Their names are listed in server\\.env.example."))

    story.append(heading("17. Terminal 1: the API"))
    story.append(P("Open PowerShell and run these commands one after another."))
    story.append(code_block(
        'cd "C:\\Users\\yasha\\OneDrive\\Desktop"\n'
        'cd "Welcome to the coding world\\WebDevProjects\\Intermediate Projects\\CHAT-APP\\server"\n'
        "npm install\n"
        "npm run server"
    ))
    story.append(P("npm run server starts nodemon on server.js. The API listens on port 5000 unless PORT is set. Leave this window open. A later line that says the server is running means the process is up. MySQL, if unset, logs that QR codes, sessions, and reports stay unavailable. Chat through MongoDB can still run."))

    story.append(heading("18. Terminal 2: the website"))
    story.append(P("Open a second PowerShell window. Do not stop the first one."))
    story.append(code_block(
        'cd "C:\\Users\\yasha\\OneDrive\\Desktop"\n'
        'cd "Welcome to the coding world\\WebDevProjects\\Intermediate Projects\\CHAT-APP\\client"\n'
        "npm install\n"
        "npm run dev"
    ))
    story.append(P("Vite prints a local address, usually http://localhost:5173. Open that address. The browser tab should say QuickChat. Sign up or log in. The client calls the API at the address in VITE_BACKEND_URL and opens a Socket.IO connection to the same place."))
    story.append(KeepTogether([
        P("To run the automated checks, use a third window only when you want them. They do not start the app."),
        code_table(
            'cd "C:\\Users\\yasha\\OneDrive\\Desktop"\n'
            'cd "Welcome to the coding world\\WebDevProjects\\Intermediate Projects\\CHAT-APP\\server"\n'
            "npm test"
        ),
        Spacer(1, 8),
    ]))

    story.append(with_table(
        "19. What still opens if a service is missing",
        table(
        ["If this is missing", "What you can still do"],
        [
            ["MySQL", "Sign in, chat, bookmarks, and requests. QR, the session list, and reports reply that MySQL is not configured."],
            ["Gemini", "Send text, photos, and voice notes. Summaries and transcripts report that Gemini is not configured."],
            ["Redis", "The one API process still cleans up expired messages and still transcribes after a voice note is saved."],
            ["MongoDB", "The website can open, but accounts and new messages cannot be saved."],
        ],
        [32 * mm, 142 * mm],
        ),
        "Table 5. Which pieces are required for which actions.",
    ))
    story.append(callout("Start Terminal 1 and wait until it is running. Start Terminal 2. Open the Vite address. Both windows must stay open while you use QuickChat."))

    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.4, color=RULE, spaceBefore=4, spaceAfter=8))
    story.append(P("Sources: README.md, client/index.html, client/context/AuthContext.jsx, client/context/ChatContext.jsx, server/server.js, server/services/messages.js, server/socket/register.js, and server/.env.example.", "small"))

    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    build()
