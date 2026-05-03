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

export async function dailyRoomExists(roomName: string) {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY nÃ£o configurada.");
  }

  const response = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  });

  if (response.status === 404) return false;

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro ao verificar sala no Daily: ${error.info || "Desconhecido"}`);
  }

  return true;
}

export async function createMeetingToken(
  roomName: string,
  isOwner: boolean = false,
  options: { notBefore?: number; canRecord?: boolean; redirectOnMeetingExit?: string } = {}
) {
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
        enable_recording_ui: Boolean(options.canRecord),
        ...(options.canRecord ? { enable_recording: "local" } : {}),
        ...(options.notBefore ? { nbf: options.notBefore } : {}),
        ...(options.redirectOnMeetingExit ? { redirect_on_meeting_exit: options.redirectOnMeetingExit } : {}),
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
