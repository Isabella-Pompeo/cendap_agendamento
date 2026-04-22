function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE";
        const ss = SpreadsheetApp.openById(sheetId);
        const sheet = ss.getSheetByName("Agendamentos");

        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // Função auxiliar para mapear cabeçalhos de forma robusta
        function getHeaderMap(sheet) {
            const lastCol = sheet.getLastColumn();
            if (lastCol === 0) return {};
            const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
            const map = {};
            headers.forEach((header, index) => {
                if (header) {
                    // Normaliza: remove espaços, acentos e põe em maiúsculo
                    const normalized = header.toString().trim()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .toUpperCase();
                    map[normalized] = index;
                }
            });
            return map;
        }

        const headerMap = getHeaderMap(sheet);
        
        // Verifica cabeçalhos essenciais (com normalização)
        const required = ["ID", "CPF", "PAGAMENTO", "STATUS", "NOME_PACIENTE", "DATA_CONSULTA"];
        const missing = required.filter(h => headerMap[h] === undefined);
        
        if (missing.length > 0) {
            return ContentService.createTextOutput(JSON.stringify({ 
                "result": "error", 
                "message": "Colunas essenciais não encontradas: " + missing.join(", "),
                "found": Object.keys(headerMap)
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: BUSCAR AGENDAMENTOS POR CPF ---
        if (action === 'list_by_cpf') {
            let searchCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');

            if (searchCpf.length === 11) {
                const dataValues = sheet.getDataRange().getValues();
                const results = [];
                
                const idxId = headerMap["ID"];
                const idxDataCriacao = headerMap["DATA_CRIACAO"] || headerMap["DATA"];
                const idxNome = headerMap["NOME_PACIENTE"] || headerMap["PACIENTE"];
                const idxTelefone = headerMap["TELEFONE"] || headerMap["CELULAR"] || headerMap["WHATSAPP"] || headerMap["FONE"];
                const idxCpf = headerMap["CPF"];
                const idxMedico = headerMap["MEDICO"];
                const idxEspecialidade = headerMap["ESPECIALIDADE"];
                const idxDataConsulta = headerMap["DATA_CONSULTA"];
                const idxHorario = headerMap["HORARIO"];
                const idxTipo = headerMap["TIPO"];
                const idxCupom = headerMap["CUPOM"];
                const idxPagamento = headerMap["PAGAMENTO"];
                const idxStatus = headerMap["STATUS"];

                for (let i = 1; i < dataValues.length; i++) {
                    let rowCpf = String(dataValues[i][idxCpf] || "").replace(/\D/g, "").padStart(11, '0');
                    
                    if (rowCpf === searchCpf) {
                        results.push({
                            id: dataValues[i][idxId],
                            data_criacao: dataValues[i][idxDataCriacao],
                            nome_paciente: dataValues[i][idxNome],
                            telefone: dataValues[i][idxTelefone],
                            cpf: dataValues[i][idxCpf],
                            medico: dataValues[i][idxMedico],
                            especialidade: dataValues[i][idxEspecialidade],
                            data_consulta: dataValues[i][idxDataConsulta],
                            horario: dataValues[i][idxHorario],
                            tipo: dataValues[i][idxTipo],
                            cupom: dataValues[i][idxCupom],
                            pagamento: dataValues[i][idxPagamento],
                            status: dataValues[i][idxStatus]
                        });
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": results })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // --- AÇÃO: VALIDAR CUPOM ---
        if (action === 'validate_coupon') {
            const cupom = String(data.cupom || "").trim().toUpperCase();
            const cpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');
            
            if (cupom === 'DRANDRE10') {
                const dataValues = sheet.getDataRange().getValues();
                const idxCpf = headerMap["CPF"];
                const idxCupom = headerMap["CUPOM"];
                
                for (let i = 1; i < dataValues.length; i++) {
                    let rowCpf = String(dataValues[i][idxCpf] || "").replace(/\D/g, "").padStart(11, '0');
                    let rowCupom = String(dataValues[i][idxCupom] || "").trim().toUpperCase();
                    if (rowCpf === cpf && rowCupom === cupom) {
                        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Este cupom já foi utilizado por este CPF." })).setMimeType(ContentService.MimeType.JSON);
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ "result": "success" })).setMimeType(ContentService.MimeType.JSON);
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Cupom inválido." })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- FLUXO PADRÃO: CRIAÇÃO DE NOVO AGENDAMENTO ---
        const id = "AG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const dataCriacao = new Date();
        
        let cleanedCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');
        const formattedCpf = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

        // Determina o tamanho da linha (máximo índice encontrado + 1 ou total de colunas)
        const maxIdx = Math.max(...Object.values(headerMap));
        const newRow = new Array(maxIdx + 1).fill("");
        
        // Mapeamento dinâmico
        const setField = (key, value) => {
            const idx = headerMap[key];
            if (idx !== undefined) newRow[idx] = value;
        };

        setField("ID", id);
        setField("DATA_CRIACAO", dataCriacao);
        setField("DATA", dataCriacao); // Alternativa
        
        // Nome do Paciente
        if (headerMap["NOME_PACIENTE"] !== undefined) newRow[headerMap["NOME_PACIENTE"]] = data.nome_paciente;
        else if (headerMap["PACIENTE"] !== undefined) newRow[headerMap["PACIENTE"]] = data.nome_paciente;
        
        // Telefone (vários nomes possíveis)
        const phoneKey = ["TELEFONE", "CELULAR", "WHATSAPP", "FONE"].find(k => headerMap[k] !== undefined);
        if (phoneKey) newRow[headerMap[phoneKey]] = data.telefone;

        setField("CPF", formattedCpf);
        setField("MEDICO", data.medico);
        setField("ESPECIALIDADE", data.especialidade);
        setField("DATA_CONSULTA", data.data_consulta);
        setField("HORARIO", data.horario);
        setField("TIPO", data.tipo);
        setField("CUPOM", data.cupom || "");
        setField("PAGAMENTO", data.pagamento || "");
        setField("STATUS", data.status || "Pendente");

        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({ 
            "result": "success", 
            "id": id,
            "debug_mapped_phone_col": phoneKey || "NOT_FOUND" 
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ 
            "result": "error", 
            "error": error.toString(),
            "stack": error.stack
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
