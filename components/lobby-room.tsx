"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { Ack, ParticipantsMessage } from "@/lib/socket-messages";

type Props = { code: string; hostId: string };

// Salle d'attente : la liste des participants suit les arrivées et départs.
export function LobbyRoom({ code, hostId }: Props) {
  const [participants, setParticipants] = useState<ParticipantsMessage["participants"]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const socket = io();
    socket.on("lobby:participants", (message: ParticipantsMessage) =>
      setParticipants(message.participants),
    );
    socket.on("connect_error", (err) => setError(err.message));
    socket.emit("lobby:join", { code }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
    return () => {
      socket.disconnect();
    };
  }, [code]);

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Participants ({participants.length})</h2>
      <ul aria-label="Participants" className="flex flex-col gap-1">
        {participants.map((participant) => (
          <li key={participant.id}>
            {participant.username}
            {participant.id === hostId && " (hôte)"}
          </li>
        ))}
      </ul>
    </section>
  );
}
