import {useEffect, useState} from 'react';
import ChatRecent from "./ChatRecent";
import ChatGroups from "./ChatGroups";
import NewChat from "./NewChat";
import Messages from "./Messages";
import MembersPrivateMessage from "./MembersPrivateMessage";
import MembersGroup from "./MembersGroup";
import {ChatType, ResponseNewChatDto} from "./Utils/ChatUtils.tsx";
import {chatSocket} from "./Utils/ClientSocket.tsx";

// Stylesheets: Because React-Bootstrap doesn't depend on a very precise version of Bootstrap, we don't
// ship with any included CSS. However, some stylesheet is required to use these components:
// import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.min.js';
// Put any other imports below so that CSS from your
// components takes precedence over default styles.
import '../../../css/Chat.css'

// Importing bootstrap and other modules
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Nav from 'react-bootstrap/Nav';

const Chat = () => {

    const [chatClicked, setChatClicked] = useState<ResponseNewChatDto | null>(null);
    if (chatClicked) {
        console.log("[Chat] chatClicked: ", chatClicked);
    }

    ////////////////////////////////////////////////////////////////////// CREATE/CONNECT/DISCONNECT SOCKET
    // useEffect without dependencies:
    // - When your component is added to the DOM, React will run your setup function
    // - When your component is removed from the DOM, React will run your cleanup function
    // useEffect with dependencies:
    // - After every re-render with changed dependencies, React will first run the cleanup function with the old values
    // - Then run your setup function with the new values
    useEffect(() => {
        if (!chatSocket.connected) {
            chatSocket.connect();
            chatSocket.on("connect", () => {
                console.log("[Chat] socket connected: ", chatSocket.connected, " -> socket id: " + chatSocket.id);
            });
            chatSocket.on("disconnect", (reason) => {
                if (reason === "io server disconnect") {
                    console.log("[Chat] socket disconnected: ", reason);
                    // the disconnection was initiated by the server, you need to reconnect manually
                    chatSocket.connect();
                }
                // else the socket will automatically try to reconnect
            });
        } else {
            console.log("[Chat] socket connected: ", chatSocket.connected, " -> socket id: " + chatSocket.id);
        }

        return () => {
        //     console.log(`[Chat] socket disconnected AND removeAllListeners`);
        //     // socket.removeAllListeners();
            if (chatSocket.connected) {
                chatSocket.disconnect();
                console.log("[Chat] Inside useEffect return function (Chat Component was removed from DOM): Chat socket id: ", chatSocket.id, " was disconnected");
            }
        };
    }, []);

    ////////////////////////////////////////////////////////////////////// HANDLE RECENT vs GROUPS TABS
    // recent or groups
    const [activeContentLeft, setActiveContentLeft] = useState<string>('recent');

    const handleClick = (content: null | string) => {
        setActiveContentLeft(content || '');
    };

    ////////////////////////////////////////////////////////////////////// UI OUTPUT
    return (
        <Container fluid>
            {/* I still don't understand why we need this Row here, but it is not working without it*/}
            <Row className='chat-page'>

                {/* Recent + Groups column */}
                <Col className='col-md-3'>
                    {/* Recent + Groups header */}
                    <Row className='h-10'>
                        <Nav
                            className="border-bottom p-0"
                            activeKey="recent"
                            variant="underline"
                            fill
                            onSelect={(k) => handleClick(k)}
                        >
                            <Nav.Item>
                                <Nav.Link eventKey="recent">Recent</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="groups">Groups</Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Row>
                    {/* Recent or Group body */}
                    <Row className='h-100'>
                        {activeContentLeft === 'recent' && <ChatRecent setChatClicked={setChatClicked} /> }
                        {activeContentLeft === 'groups' && <ChatGroups setChatClicked={setChatClicked} /> }
                        {/* NewChat Button */}
                        <NewChat/>
                    </Row>
                </Col>

                {/* Chat column */}
                <Col className='bg-light col-md-6'>
                    <Messages />
                </Col>

                {/* Members column */}
                <Col className='col-md-3'>
                    {/* Members header */}
                    <Row className='h-10'>
                        <Nav
                            className="border-bottom p-0"
                            activeKey="members"
                            variant="underline"
                            fill
                            // onSelect={(k) => handleClick(k)}
                        >
                            <Nav.Item>
                                <Nav.Link href="members" disabled>Members</Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Row>
                    {/* Members body */}
                    <Row className='h-100'>
                        {chatClicked?.chatType === ChatType.PRIVATE && <MembersPrivateMessage chatClicked={chatClicked}/> }
                        {chatClicked?.chatType != ChatType.PRIVATE && <MembersGroup chatClicked={chatClicked}/> }
                    </Row>
                </Col>

            </Row>
        </Container>
    )
}

export default Chat
