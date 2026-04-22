function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE";
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName("Agendamentos");

        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // Função auxiliar para mapear cabeçalhos
        function getHeaderMap(sheet) {
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const map = {};
            headers.forEach((header, index) => {
                map[header.toString().trim().toUpperCase()] = index;
            });
            return map;
        }

        const headerMap = getHeaderMap(sheet);
        const requiredHeaders = ["ID", "CPF", "PAGAMENTO", "STATUS", "NOME_PACIENTE", "DATA_CONSULTA"];
        const missingHeaders = requiredHeaders.filter(h => headerMap[h] === undefined);
        
        if (missingHeaders.length > 0) {
            return ContentService.createTextOutput(JSON.stringify({ 
                "result": "error", 
                "message": "Cabeçalhos não encontrados na planilha: " + missingHeaders.join(", ") 
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: BUSCAR AGENDAMENTOS POR CPF ---
        if (action === 'list_by_cpf') {
            // Normaliza o CPF de busca para 11 dígitos com zeros à esquerda
            let searchCpf = String(data.cpf || "").replace(/\D/g, "");
            if (searchCpf.length > 0) {
              searchCpf = searchCpf.padStart(11, '0');
            }

            if (searchCpf.length === 11) {
                const dataRange = sheet.getDataRange().getValues();
                const results = [];
                
                // Índices baseados nos nomes das colunas (mais seguro)
                const idxId = headerMap["ID"];
                const idxDataCriacao = headerMap["DATA_CRIACAO"];
                const idxNome = headerMap["NOME_PACIENTE"];
                const idxTelefone = headerMap["TELEFONE"];
                const idxCpf = headerMap["CPF"];
                const idxMedico = headerMap["MEDICO"];
                const idxEspecialidade = headerMap["ESPECIALIDADE"];
                const idxData = headerMap["DATA_CONSULTA"];
                const idxHorario = headerMap["HORARIO"];
                const idxTipo = headerMap["TIPO"];
                const idxCupom = headerMap["CUPOM"];
                const idxPagamento = headerMap["PAGAMENTO"];
                const idxStatus = headerMap["STATUS"];

                for (let i = 1; i < dataRange.length; i++) {
                    // Normaliza o CPF da linha para 11 dígitos para comparação
                    const rowCpf = String(dataRange[i][idxCpf] || "").replace(/\D/g, "").padStart(11, '0');
                    
                    if (rowCpf === searchCpf) {
                        results.push({
                            id: dataRange[i][idxId],
                            data_criacao: dataRange[i][idxDataCriacao],
                            nome: dataRange[i][idxNome],
                            telefone: dataRange[i][idxTelefone],
                            cpf: dataRange[i][idxCpf],
                            medico: dataRange[i][idxMedico],
                            especialidade: dataRange[i][idxEspecialidade],
                            data_consulta: dataRange[i][idxData],
                            horario: dataRange[i][idxHorario],
                            tipo: dataRange[i][idxTipo],
                            cupom: dataRange[i][idxCupom],
                            pagamento: dataRange[i][idxPagamento],
                            status: dataRange[i][idxStatus]
                        });
                    }
                }

                // Inverte para mostrar os mais recentes primeiro
                results.reverse();

                return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": results })).setMimeType(ContentService.MimeType.JSON);
            } else {
                return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "CPF inválido ou não informado" })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // --- AÇÃO: BUSCAR DADOS DO PACIENTE POR CPF (PARA AUTO-PREENCHER) ---
        if (action === 'fetch_patient_by_cpf') {
            let searchCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');
            const dataRange = sheet.getDataRange().getValues();
            const idxCpf = headerMap["CPF"];
            const idxNome = headerMap["NOME_PACIENTE"];
            const idxTelefone = headerMap["TELEFONE"];

            // Busca da mais recente para a mais antiga
            for (let i = dataRange.length - 1; i >= 1; i--) {
                const rowCpf = String(dataRange[i][idxCpf] || "").replace(/\D/g, "").padStart(11, '0');
                if (rowCpf === searchCpf) {
                    return ContentService.createTextOutput(JSON.stringify({
                        "result": "success",
                        "data": {
                            "nome": dataRange[i][idxNome],
                            "telefone": dataRange[i][idxTelefone]
                        }
                    })).setMimeType(ContentService.MimeType.JSON);
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Paciente não encontrado" })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: ATUALIZAR STATUS PELO ID DE PAGAMENTO (WEBHOOK) ---
        if (action === 'update_status_by_payment_id') {
            const pagamentoId = String(data.pagamento);
            const novoStatus = data.status || "Pago";
            const dataRange = sheet.getDataRange().getValues();
            const idxPagamento = headerMap["PAGAMENTO"];
            const idxStatus = headerMap["STATUS"];

            for (let i = 1; i < dataRange.length; i++) {
                if (String(dataRange[i][idxPagamento]) === pagamentoId) {
                    sheet.getRange(i + 1, idxStatus + 1).setValue(novoStatus);
                    return ContentService.createTextOutput(JSON.stringify({ "result": "success" })).setMimeType(ContentService.MimeType.JSON);
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Pagamento não encontrado" })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- FLUXO PADRÃO: CRIAÇÃO DE NOVO AGENDAMENTO ---
        const id = "AG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const dataCriacao = new Date();
        
        // Garante que o CPF tenha zeros à esquerda se necessário
        let cleanedCpf = String(data.cpf || "").replace(/\D/g, "");
        if (cleanedCpf.length > 0) cleanedCpf = cleanedCpf.padStart(11, '0');
        
        // Formata o CPF com a máscara para salvar bonito
        const formattedCpf = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

        // Prepara o array da linha baseado nos nomes das colunas
        const columnsCount = sheet.getLastColumn();
        const newRow = new Array(columnsCount).fill("");
        
        newRow[headerMap["ID"]] = id;
        newRow[headerMap["DATA_CRIACAO"]] = dataCriacao;
        newRow[headerMap["NOME_PACIENTE"]] = data.nome_paciente;
        newRow[headerMap["TELEFONE"]] = data.telefone;
        newRow[headerMap["CPF"]] = formattedCpf;
        newRow[headerMap["MEDICO"]] = data.medico;
        newRow[headerMap["ESPECIALIDADE"]] = data.especialidade;
        newRow[headerMap["DATA_CONSULTA"]] = data.data_consulta;
        newRow[headerMap["HORARIO"]] = data.horario;
        newRow[headerMap["TIPO"]] = data.tipo;
        newRow[headerMap["CUPOM"]] = data.cupom || "";
        newRow[headerMap["PAGAMENTO"]] = data.pagamento || "";
        newRow[headerMap["STATUS"]] = data.status || "Pendente";

        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": id })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
