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
            for (let i = 1; i < dataRange.length; i++) {
                if (dataRange[i][0] == searchId) {
                    const row = dataRange[i];
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "data": {
                            id: row[0],
                            data_criacao: row[1],
                            nome: row[2],
                            telefone: row[3], // Telefone
                            medico: row[4],
                            especialidade: row[5],
                            data_consulta: row[6], // Data formatada
                            horario: row[7],
                            tipo: row[8], // Tipo (Consulta/Retorno/Exame)
                            status: row[9], // Status na coluna J
                            info_adicional: row[10] || '' // Info Adicional na coluna K
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
            data.telefone,              // D: telefone/whatsapp
            data.medico,                // E: medico
            data.especialidade,         // F: especialidade
            data.data_consulta,         // G: data_consulta
            data.horario,               // H: horario
            data.tipo,                  // I: tipo
            "Pendente",                 // J: status
            data.info_adicional || ""   // K: info_adicional
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": id }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
