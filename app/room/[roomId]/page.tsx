'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { use } from 'react';

interface PeerConnection {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
}

export default function Room({ params }: { params: { roomId: string } }) {
  const roomId = use(Promise.resolve(params.roomId));
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  
  const socketRef = useRef<any>();
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerConnection[]>([]);
  const streamRef = useRef<MediaStream>();

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }

      socketRef.current = io('http://localhost:3001');
      
      socketRef.current.emit('join-room', { roomId, userName });

      socketRef.current.on('all-users', (users: { id: string, userName: string }[]) => {
        const peers: PeerConnection[] = [];
        
        users.forEach(user => {
          const peer = createPeer(user.id, socketRef.current.id, stream);
          peersRef.current.push({
            peerId: user.id,
            peer,
          });
          peers.push({
            peerId: user.id,
            peer,
          });
        });
        
        setPeers(peers);
      });

      socketRef.current.on('user-joined', ({ signal, callerId }) => {
        const peer = addPeer(signal, callerId, stream);
        peersRef.current.push({
          peerId: callerId,
          peer,
        });

        setPeers(prev => [...prev, { peerId: callerId, peer }]);
      });

      socketRef.current.on('receiving-returned-signal', ({ id, signal }) => {
        const item = peersRef.current.find(p => p.peerId === id);
        item?.peer.signal(signal);
      });

      setIsJoined(true);
    } catch (err) {
      console.error('Error joining room:', err);
    }
  };

  const createPeer = (userToSignal: string, callerId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socketRef.current.emit('sending-signal', { userToSignal, callerId, signal });
    });

    return peer;
  };

  const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socketRef.current.emit('returning-signal', { signal, callerId });
    });

    peer.signal(incomingSignal);

    return peer;
  };

  const handleScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          cursor: 'always'
        },
        audio: false
      });

      // Store the original video track for later
      const videoTrack = streamRef.current?.getVideoTracks()[0];

      // Replace the video track in the current stream
      if (streamRef.current) {
        const sender = streamRef.current.getVideoTracks()[0];
        streamRef.current.removeTrack(sender);
        streamRef.current.addTrack(screenStream.getVideoTracks()[0]);
      }

      // Update the video element
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = screenStream;
      }

      // Replace the track for all peers
      peers.forEach(({ peer }) => {
        const sender = peer.streams[0].getVideoTracks()[0];
        peer.replaceTrack(
          sender,
          screenStream.getVideoTracks()[0],
          streamRef.current!
        );
      });

      // Handle screen sharing stop
      screenStream.getVideoTracks()[0].onended = () => {
        // Revert back to camera when screen sharing stops
        if (streamRef.current && videoTrack) {
          const sender = streamRef.current.getVideoTracks()[0];
          streamRef.current.removeTrack(sender);
          streamRef.current.addTrack(videoTrack);

          if (userVideoRef.current) {
            userVideoRef.current.srcObject = streamRef.current;
          }

          // Update all peers
          peers.forEach(({ peer }) => {
            const sender = peer.streams[0].getVideoTracks()[0];
            peer.replaceTrack(
              sender,
              videoTrack,
              streamRef.current!
            );
          });
        }
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    socketRef.current.emit('send-message', {
      roomId,
      message,
      userName,
    });
    setMessages(prev => [...prev, { user: 'You', text: message }]);
    setMessage('');
  };

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      peers.forEach(({ peer }) => peer.destroy());
    };
  }, []);

  if (!isJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="px-4 py-2 border rounded-lg text-black"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Join Room
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-2rem)]">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div className="relative">
            <video
              ref={userVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-lg"
            />
            <p className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded">
              You ({userName})
            </p>
          </div>
          {peers.map(({ peerId }) => (
            <div key={peerId} className="relative">
              <video
                id={`peer-${peerId}`}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={handleScreenShare}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              Share Screen
            </button>
          </div>

          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className="mb-2">
                <span className="font-bold">{msg.user}:</span> {msg.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded-lg text-black"
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 