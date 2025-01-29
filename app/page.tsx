'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleCreateRoom = () => {
    const roomId = uuidv4();
    router.push(`/room/${roomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinRoomId.trim()) {
      router.push(`/room/${joinRoomId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8">
      <h1 className="text-2xl font-bold">Simple Video Chat</h1>
      
      <button
        onClick={handleCreateRoom}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
        aria-label="Create new room"
      >
        Create New Room
      </button>

      <div className="flex flex-col items-center gap-4">
        <p className="text-lg">or join existing room</p>
        
        <form onSubmit={handleJoinRoom} className="flex gap-2">
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="px-4 py-2 border rounded-lg text-black"
            aria-label="Room ID input"
          />
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
            aria-label="Join room"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
