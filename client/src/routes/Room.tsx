import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const Room = () => {
  const location = useLocation();

  const roomId = window.location.pathname.split("/")[2];
  const locationName = location.state?.name || "";

  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const [name, setName] = useState<string>(locationName);
  const [room] = useState<string>(roomId);
  const [needName, setNeedName] = useState<boolean>(!locationName);
  const [inputName, setInputName] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);

  const rtcPeerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  // We'll store remote peer socketId for name mapping
  const remoteSocketId = useRef<string | null>(null);

  const notify = (msg: string) => toast.error(msg);

  const handleRoomEnter = () => {
    if (inputName.trim() === "") {
      notify("Please enter your name");
    } else if (/\d/.test(inputName)) {
      notify("Name should not contain numbers");
    } else if (inputName.length < 3) {
      notify("Name too short");
    } else {
      setName(inputName);
      setNeedName(false);
    }
  };

  const setupLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch {
      toast.error("Could not access media devices");
      throw new Error("Media devices error");
    }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setVideoOff(!videoOff);
  };

  useEffect(() => {
    if (!needName && name && room) {
      const socket = io(import.meta.env.VITE_SERVER);
      socket.on("connect", async () => {
        console.log("Connected to signaling server");
        toast.success("Connected to signaling server");
        await setupLocalMedia();

        socket.emit("join-room", { roomId: room, name });
      });

      // Receive all other users in room (array of { socketId, name })
      socket.on(
        "all-users",
        async (users: { socketId: string; name: string }[]) => {
          if (users.length > 0) {
            const otherUser = users[0];
            remoteSocketId.current = otherUser.socketId;
            setReceiverName(otherUser.name);

            rtcPeerConnection.current = new RTCPeerConnection({
              iceServers: ICE_SERVERS,
            });

            // Add local tracks
            if (localStream.current) {
              localStream.current.getTracks().forEach((track) => {
                rtcPeerConnection.current?.addTrack(track, localStream.current!);
              });
            }

            // ICE candidate handler
            rtcPeerConnection.current.onicecandidate = (event) => {
              if (event.candidate) {
                socket.emit("ice-candidate", {
                  roomId: room,
                  candidate: event.candidate,
                });
              }
            };

            // Remote track handler
            rtcPeerConnection.current.ontrack = (event) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setRemoteStreamActive(true);
              }
            };

            const offer = await rtcPeerConnection.current.createOffer();
            await rtcPeerConnection.current.setLocalDescription(offer);
            socket.emit("offer", { roomId: room, offer });
          }
        }
      );

      // Someone joined later (update name and remoteSocketId)
      socket.on("user-joined", ({ socketId, name: newUserName }) => {
        remoteSocketId.current = socketId;
        setReceiverName(newUserName);
        toast.success(`${newUserName} joined the room`);
      });

      // Receiving an offer (you are the receiver)
      socket.on("offer", async ({ offer, senderId }) => {
        remoteSocketId.current = senderId;
        setReceiverName("Remote User");

        rtcPeerConnection.current = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
        });

        // Add local tracks
        if (localStream.current) {
          localStream.current.getTracks().forEach((track) => {
            rtcPeerConnection.current?.addTrack(track, localStream.current!);
          });
        }

        rtcPeerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              roomId: room,
              candidate: event.candidate,
            });
          }
        };

        rtcPeerConnection.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setRemoteStreamActive(true);
          }
        };

        await rtcPeerConnection.current.setRemoteDescription(offer);

        const answer = await rtcPeerConnection.current.createAnswer();
        await rtcPeerConnection.current.setLocalDescription(answer);

        socket.emit("answer", { roomId: room, answer });
      });

      // Receive answer to your offer
      socket.on("answer", async ({ answer }) => {
        await rtcPeerConnection.current?.setRemoteDescription(answer);
      });

      // ICE candidates received
      socket.on("ice-candidate", async ({ candidate }) => {
        try {
          await rtcPeerConnection.current?.addIceCandidate(candidate);
        } catch (err) {
          console.error("Error adding received ice candidate", err);
        }
      });

      return () => {
        socket.disconnect();
        rtcPeerConnection.current?.close();
        if (localStream.current) {
          localStream.current.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [needName, name, room]);

  // UI for name input
  if (needName) {
    return (
      <div className="p-5 flex flex-col justify-center items-center h-screen bg-gray-900 text-neutral-300">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Welcome to Video Call App
        </h1>
        <div className="flex gap-2">
          <input
            className="px-4 py-1 outline-none bg-gray-700 rounded-md"
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRoomEnter()}
            placeholder="Enter your name..."
            value={inputName}
          />
          <button
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
            onClick={handleRoomEnter}
          >
            Enter Room
          </button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="p-5 flex flex-col h-screen bg-gray-900 text-neutral-300">
      <div className="flex flex-col items-center justify-center gap-2">
        <h1 className="text-4xl font-bold">Video Call Room</h1>
        <p className="text-lg">Room Id: {room}</p>
      </div>

      <div className="md:flex h-[60vh] gap-5 mt-10 space-y-5 md:space-y-0">
        {/* Local video */}
        <div className="md:w-1/2 flex flex-col items-center gap-2">
          <h1 className="font-semibold text-2xl">{name || "GuestSender"}</h1>
          <div className="w-full md:h-full rounded-md bg-black relative">
            <video
              className="w-full h-full object-cover rounded-md"
              ref={myVideoRef}
              autoPlay
              muted
              playsInline
            />
            <div className="absolute bottom-2 left-2 flex gap-2">
              <button
                onClick={toggleMute}
                className="px-3 py-1 bg-gray-700 rounded text-white"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={toggleVideo}
                className="px-3 py-1 bg-gray-700 rounded text-white"
              >
                {videoOff ? "Start Video" : "Stop Video"}
              </button>
            </div>
          </div>
        </div>

        {/* Remote video */}
        <div className="md:w-1/2 flex flex-col items-center gap-2">
          <h1 className="font-semibold text-2xl">
            {receiverName || "GuestReceiver"}
          </h1>
          <div className="w-full md:h-full rounded-md bg-black relative">
            <video
              className="w-full h-full object-cover rounded-md"
              ref={remoteVideoRef}
              autoPlay
              playsInline
              onPlay={() => setRemoteStreamActive(true)}
              onPause={() => setRemoteStreamActive(false)}
            />
            {!remoteStreamActive && (
              <div className="absolute inset-0 flex justify-center items-center text-white bg-gray-800 rounded-md opacity-80">
                No video available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room
