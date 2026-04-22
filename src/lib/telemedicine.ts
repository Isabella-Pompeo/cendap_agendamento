const DAILY_API_KEY = process.env.DAILY_API_KEY;

export async function createDailyRoom(roomName?: string) {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY não configurada.");
  }

  // Gera um nome único se não for fornecido
  const name = roomName || `consulta-${Date.now()}`;

  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_chat: true,
        start_audio_off: false,
        start_video_off: false,
        exp: Math.round(Date.now() / 1000) + 86400, // Expira em 24h
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro ao criar sala no Daily: ${error.info || "Desconhecido"}`);
  }

  const data = await response.json();
  
  return {
    url: data.url,
    name: data.name,
  };
}

export async function createMeetingToken(roomName: string, isOwner: boolean = false) {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY não configurada.");
  }

  const response = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro ao gerar token: ${error.info || "Desconhecido"}`);
  }

  const data = await response.json();
  return data.token;
}
