function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE";
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName("Agendamentos");

        const data = JSON.parse(e.postData.contents);

        // MODO DE CANCELAMENTO (Cancelar Agendamento pelo paciente)
        if (data.action === 'cancel') {
            const cancelId = data.id;
            const dataRange = sheet.getDataRange().getValues();

            for (let i = 1; i < dataRange.length; i++) {
                if (dataRange[i][0] == cancelId) {
                    // Coluna L (12ª coluna) = Status
                    sheet.getRange(i + 1, 12).setValue('Cancelado');
                    
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "message": "Agendamento cancelado"
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "ID não encontrado" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE EDIÇÃO (Dados do paciente no Agendamento)
        if (data.action === 'edit_patient_data') {
            const editId = data.id;
            const dataRange = sheet.getDataRange().getValues();

            for (let i = 1; i < dataRange.length; i++) {
                if (dataRange[i][0] == editId) {
                    // Coluna C (3) Nome, D (4) Telefone, E (5) CPF
                    if (data.nome_paciente !== undefined) sheet.getRange(i + 1, 3).setValue(data.nome_paciente);
                    if (data.telefone !== undefined) sheet.getRange(i + 1, 4).setValue(data.telefone);
                    if (data.cpf !== undefined) sheet.getRange(i + 1, 5).setValue(data.cpf);
                    
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "message": "Dados atualizados"
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
                    const rowCpf = String(dataRange[i][4] || "").replace(/\D/g, ""); // Coluna E (índice 4)
                    if (rowCpf === searchCpf) {
                        return ContentService.createTextOutput(JSON.stringify({
                            "result": "success",
                            "data": {
                                nome: dataRange[i][2],      // Coluna C
                                telefone: dataRange[i][3]   // Coluna D
                            }
                        })).setMimeType(ContentService.MimeType.JSON);
                    }
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "not_found" })).setMimeType(ContentService.MimeType.JSON);
        }

        // MODO LISTAR TODOS AGENDAMENTOS POR CPF
        if (data.action === 'list_by_cpf') {
            const searchCpf = (data.cpf || "").replace(/\D/g, "");
            const results = [];
            if (searchCpf.length === 11) {
                const dataRange = sheet.getDataRange().getValues();
                
                for (let i = 1; i < dataRange.length; i++) {
                    const rowCpf = String(dataRange[i][4] || "").replace(/\D/g, ""); // Coluna E
                    if (rowCpf === searchCpf) {
                        results.push({
                            id: dataRange[i][0],
                            data_criacao: dataRange[i][1],
                            nome: dataRange[i][2],
                            telefone: dataRange[i][3],
                            cpf: dataRange[i][4],
                            medico: dataRange[i][5],
                            especialidade: dataRange[i][6],
                            data_consulta: dataRange[i][7],
                            horario: dataRange[i][8],
                            tipo: dataRange[i][9],
                            status: dataRange[i][11]
                        });
                    }
                }
            }
            // Retorna os mais recentes primeiro
            results.reverse();
            return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": results })).setMimeType(ContentService.MimeType.JSON);
        }

        // MODO DE VALIDAÇÃO DE CUPOM (Garantir uso único por CPF)
        if (data.action === 'validate_coupon') {
            const tempCpf = (data.cpf || "").replace(/\D/g, "");
            const tempCoupon = (data.cupom || "").toUpperCase().trim();
            const dataRange = sheet.getDataRange().getValues();
            
            for (let i = 1; i < dataRange.length; i++) {
                // Coluna E (índice 4) é o CPF. Coluna K (índice 10) é o cupom.
                if (dataRange[i][4] && dataRange[i][10]) {
                    const rowCpf = String(dataRange[i][4]).replace(/\D/g, "");
                    const rowCoupon = String(dataRange[i][10]).toUpperCase().trim();
                    
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
            data.telefone,              // D: telefone/whatsapp
            data.cpf || "",             // E: cpf
            data.medico,                // F: medico
            data.especialidade,         // G: especialidade
            data.data_consulta,         // H: data_consulta
            data.horario,               // I: horario
            data.tipo,                  // J: tipo
            data.cupom || "",           // K: cupom
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
