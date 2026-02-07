function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE"; // Seu ID da planilha
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName("Agendamentos"); // Certifique-se que o nome da aba é este

        const data = JSON.parse(e.postData.contents);

        // MODO DE BUSCA (Verificar Agendamento)
        if (data.action === 'search') {
            const searchId = data.id;
            const dataRange = sheet.getDataRange().getValues();

            // Procura o ID na coluna A (índice 0)
            // Começa do índice 1 para pular o cabeçalho
            // Procura o ID na coluna A (índice 0)
            // Começa do índice 1 para pular o cabeçalho
            for (let i = 1; i < dataRange.length; i++) {
                if (dataRange[i][0] == searchId) {
                    const row = dataRange[i];
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "data": {
                            id: row[0],
                            data_criacao: row[1],
                            nome: row[2],
                            altura: row[3],
                            peso: row[4],
                            telefone: row[5],
                            medico: row[6],
                            especialidade: row[7],
                            data_consulta: row[8],
                            horario: row[9],
                            tipo: row[10],
                            status: row[11],
                            info_adicional: row[12] || ''
                        }
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Agendamento não encontrado." }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE CRIAÇÃO (Novo Agendamento)
        // Gera um ID MAIS CURTO (8 primeiros caracteres do UUID)
        const fullUuid = Utilities.getUuid();
        const id = fullUuid.substring(0, 8);

        // Data de criação agora
        const dataCriacao = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm");

        sheet.appendRow([
            id,                         // A: id
            dataCriacao,                // B: data_criacao
            data.nome_paciente,         // C: nome_paciente
            data.altura || "",          // D: altura
            data.peso || "",            // E: peso
            data.telefone,              // F: telefone/whatsapp
            data.medico,                // G: medico
            data.especialidade,         // H: especialidade
            data.data_consulta,         // I: data_consulta
            data.horario,               // J: horario
            data.tipo,                  // K: tipo
            "Pendente",                 // L: status
            data.info_adicional || ""   // M: info_adicional
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": id }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
