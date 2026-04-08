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
                            cpf: row[6],             // G (6): cpf
                            medico: row[7],          // H (7): medico
                            especialidade: row[8],   // I (8): especialidade
                            data_consulta: row[9],   // J (9): data_consulta
                            horario: row[10],        // K (10): horario
                            tipo: row[11],           // L (11): tipo
                            cupom: row[12],          // M (12): cupom
                            status: row[13],         // N (13): status
                            info_adicional: row[14] || '' // O (14): info_adicional
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
                    // Coluna N (14ª coluna) = Status
                    sheet.getRange(i + 1, 14).setValue('Cancelado');
                    
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "message": "Agendamento cancelado"
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "ID não encontrado" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // MODO BUSCA PACIENTE PELO CPF (Autocompletar)
        if (data.action === 'fetch_patient_by_cpf') {
            const searchCpf = (data.cpf || "").replace(/\D/g, "");
            if (searchCpf.length === 11) {
                const dataRange = sheet.getDataRange().getValues();
                
                // Busca de baixo pra cima para pegar a consulta mais recente
                for (let i = dataRange.length - 1; i > 0; i--) {
                    const rowCpf = String(dataRange[i][6] || "").replace(/\D/g, ""); // Coluna G (índice 6)
                    if (rowCpf === searchCpf) {
                        return ContentService.createTextOutput(JSON.stringify({
                            "result": "success",
                            "data": {
                                nome: dataRange[i][2],      // Coluna C
                                altura: dataRange[i][3],    // Coluna D
                                peso: dataRange[i][4],      // Coluna E
                                telefone: dataRange[i][5]   // Coluna F
                            }
                        })).setMimeType(ContentService.MimeType.JSON);
                    }
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "not_found" })).setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE VALIDAÇÃO DE CUPOM (Garantir uso único por CPF)
        if (data.action === 'validate_coupon') {
            const tempCpf = (data.cpf || "").replace(/\D/g, "");
            const tempCoupon = (data.cupom || "").toUpperCase().trim();
            const dataRange = sheet.getDataRange().getValues();
            
            for (let i = 1; i < dataRange.length; i++) {
                // Coluna G (índice 6) é o CPF. Coluna M (índice 12) é o cupom.
                if (dataRange[i][6] && dataRange[i][12]) {
                    const rowCpf = String(dataRange[i][6]).replace(/\D/g, "");
                    const rowCoupon = String(dataRange[i][12]).toUpperCase().trim();
                    
                    if (rowCpf === tempCpf && rowCoupon === tempCoupon) {
                        return ContentService.createTextOutput(JSON.stringify({
                            "result": "error",
                            "message": "Este cupom não está mais disponivel"
                        })).setMimeType(ContentService.MimeType.JSON);
                    }
                }
            }

            return ContentService.createTextOutput(JSON.stringify({
                "result": "success",
                "message": "Cupom válido."
            })).setMimeType(ContentService.MimeType.JSON);
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
            data.cpf || "",             // G: cpf
            data.medico,                // H: medico
            data.especialidade,         // I: especialidade
            data.data_consulta,         // J: data_consulta
            data.horario,               // K: horario
            data.tipo,                  // L: tipo
            data.cupom || "",           // M: cupom
            "Pendente",                 // N: status
            data.info_adicional || ""   // O: info_adicional
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": id }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
