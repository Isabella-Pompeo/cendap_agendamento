function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE";
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName("Agendamentos");

        const data = JSON.parse(e.postData.contents);

        // MODO DE BUSCA (Verificar Agendamento)
        if (data.action === 'search') {
            const searchId = data.id;
            const dataRange = sheet.getDataRange().getValues();

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
                            cupom: row[11],          // L (12): cupom
                            status: row[12],         // M (13): status
                            info_adicional: row[13] || '' // N (14): info_adicional
                        }
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Agendamento não encontrado." }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE CANCELAMENTO (Cancelar Agendamento pelo paciente)
        if (data.action === 'cancel') {
            const cancelId = data.id;
            const dataRange = sheet.getDataRange().getValues();

            for (let i = 1; i < dataRange.length; i++) {
                if (dataRange[i][0] == cancelId) {
                    // Coluna M (13ª coluna) = Status (mudou pois adicionamos Cupom na L)
                    sheet.getRange(i + 1, 13).setValue('Cancelado');
                    
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "message": "Agendamento cancelado"
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "ID não encontrado" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // =====================================================================
        // MODO DE LISTA DE ESPERA (Nova Aba)
        // =====================================================================
        if (data.tipo === 'Lista de Espera') {
            const waitlistSheet = ss.getSheetByName("lista de espera");
            const dataRegistro = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm");
            
            // Vai adicionar na seguinte ordem:
            waitlistSheet.appendRow([
                data.nome_paciente,         // Coluna A (nome)
                data.telefone,              // Coluna B (telefone)
                data.medico,                // Coluna C (medico)
                data.especialidade,         // Coluna D (especialidade)
                dataRegistro                // Coluna E (dataRegistro)
            ]);
            
            return ContentService.createTextOutput(JSON.stringify({ "result": "success", "message": "Adicionado à lista de espera" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE CRIAÇÃO (Novo Agendamento)
        const fullUuid = Utilities.getUuid();
        const id = 'AG-' + fullUuid.substring(0, 8).toUpperCase();
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
            data.cupom || "",           // L: cupom
            "Pendente",                 // M: status
            data.info_adicional || ""   // N: info_adicional
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": id }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
