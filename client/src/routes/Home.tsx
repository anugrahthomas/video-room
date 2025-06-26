import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const roomId: string = Math.random().toString(36).substring(2, 20);
  const [name, setName] = useState<string>("");
  
  const navigate = useNavigate();

  const notify = (alert: string) => toast.error(alert);

  const handleCreateRoom = () => {
    if (name.trim() === "") {
      notify("Please enter your name");
    } else if (/\d/.test(name)) {
      notify("Name should not contain numbers");
    } else if (name.length < 3) {
      notify("Name too small");
    } else {
      navigate(`/room/${roomId}`, {
        state: {
          name: name,
          roomId: roomId,
        },
      });
    }
  };
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-neutral-300">
      <h1 className="text-3xl md:text-4xl font-bold mb-4">
        Welcome to Video Call App
      </h1>
      <p className="text-md md:text:lg mb-8">
        Create or join a room to start video calling.
      </p>
      <div className="flex gap-2">
        <input
          className="px-4 py-1 outline-none bg-gray-700 rounded-md"
          type="text"
          placeholder="Enter your name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreateRoom();
            }
          }}
        />
        <button
          onClick={handleCreateRoom}
          className="px-6 py-3 bg-blue-500 text-neutral-100 rounded-md font-semibold hover:bg-blue-600 transition"
        >
          Create Room
        </button>
      </div>
    </div>
  );
};
export default Home;
