import { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");
const sessionId = Math.floor(Math.random() * 36 ** 7).toString(36);

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  let localStream;
  let remoteStream;
  let peerConnection;

  console.log(sessionId);

  const servers = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
  };

  let init = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    document.getElementById("user-1").srcObject = localStream;

    createOffer();
  };

  let createPeerConnection = async () => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById("user-2").srcObject = remoteStream;

    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      document.getElementById("user-1").srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        socket.emit(
          "candidate",
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };
  };

  let createOffer = async () => {
    await createPeerConnection();

    let offer = await peerConnection.createOffer();

    console.log(
      "Offer: ",
      peerConnection.signalingState,
      peerConnection.signalingState == "stable"
    );

    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", JSON.stringify({ type: "offer", offer: offer }));
  };

  let createAnswer = async (offer) => {
    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();

    console.log("Answer: ", peerConnection.signalingState);

    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", JSON.stringify({ type: "answer", answer: answer }));
  };

  let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
      peerConnection.setRemoteDescription(answer);
    }
  };

  useEffect(() => {
    socket.on("message", (message, senderId) => {
      setMessages([...messages, { message: message, id: senderId }]);
    });
  }, [messages]);

  useEffect(() => {
    socket.on("offer", (offer) => {
      offer = JSON.parse(offer);
      if (offer.type == "offer") {
        createAnswer(offer.offer);
      }
    });
  }, []);

  useEffect(() => {
    socket.on("answer", (answer) => {
      answer = JSON.parse(answer);
      if (answer.type == "answer") {
        addAnswer(answer.answer);
      }
    });
  }, []);

  useEffect(() => {
    socket.on("candidate", (candidate) => {
      candidate = JSON.parse(candidate);

      if (peerConnection) {
        peerConnection.addIceCandidate(candidate.candidate);
      }
    });
  }, [peerConnection]);

  useEffect(() => {
    socket.on("user-disconnected", () => {
      remoteStream = "";
    });
  }, []);

  const sendMessage = () => {
    socket.emit("message", inputValue, sessionId);
    messages.push({ message: inputValue, id: sessionId });
    setInputValue("");
  };

  useEffect(() => {
    init();
  }, []);

  return (
    <div className="body">
      <div id="videos">
        <video
          className="video-player"
          id="user-1"
          autoPlay
          playsInline
        ></video>
        <video
          className="video-player"
          id="user-2"
          autoPlay
          playsInline
        ></video>
      </div>

      <div style={{marginLeft: "20px"}}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>

        <div>
          <div>
            {messages.map((message, index) => (
              <div key={index} style={{ display: "flex" }}>
                <p>{message.id}:&nbsp;</p>
                <p> {message.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
