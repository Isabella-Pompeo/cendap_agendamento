function doPost(e) {
    try {
        const sheetId = "1J8nXOU8qFxXuruAbcIBgg8YuWh8gQV8RWNTcRKiJAeE";
        const ss = SpreadsheetApp.openById(sheetId);
        
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // Determina qual aba usar baseada no tipo ou ação
        let sheetName = "Agendamentos";
        if (data.tipo === 'Lista de Espera') {
            sheetName = "lista de espera";
        }
        
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ 
                "result": "error", 
                "message": "Aba '" + sheetName + "' não encontrada na planilha." 
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Função auxiliar para mapear cabeçalhos de forma robusta
        function getHeaderMap(targetSheet) {
            const lastCol = targetSheet.getLastColumn();
            if (lastCol === 0) return {};
            const headers = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
            const map = {};
            headers.forEach((header, index) => {
                if (header) {
                    // Normaliza: remove espaços extras, acentos e põe em maiúsculo
                    const normalized = header.toString().trim()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .toUpperCase()
                        .replace(/[^A-Z0-2_]/g, ""); // Remove caracteres especiais como "/"
                    map[normalized] = index;
                    
                    // Adiciona mapeamento simplificado também (apenas as primeiras 4 letras)
                    const simple = normalized.substring(0, 4);
                    if (!map[simple]) map[simple] = index;
                }
            });
            return map;
        }

        const headerMap = getHeaderMap(sheet);
        
        // Função para buscar o índice da coluna por variantes
        const getIdx = (variants) => {
            for (let v of variants) {
                const normV = v.toUpperCase().replace(/[^A-Z0-2_]/g, "");
                if (headerMap[normV] !== undefined) return headerMap[normV];
                
                // Busca por prefixo (ex: "TELE" encontra "TELEFONE")
                const prefix = normV.substring(0, 4);
                if (headerMap[prefix] !== undefined) return headerMap[prefix];
            }
            return undefined;
        };

        // --- AÇÃO: BUSCAR AGENDAMENTOS POR CPF ---
        if (action === 'list_by_cpf') {
            let searchCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');

            if (searchCpf.length === 11) {
                // Ao listar para o perfil, buscamos prioritariamente na aba Agendamentos
                const profileSheet = ss.getSheetByName("Agendamentos");
                const profileHeaderMap = getHeaderMap(profileSheet);
                
                const getProfileIdx = (variants) => {
                    for (let v of variants) {
                        const normV = v.toUpperCase().replace(/[^A-Z0-2_]/g, "");
                        if (profileHeaderMap[normV] !== undefined) return profileHeaderMap[normV];
                        const prefix = normV.substring(0, 4);
                        if (profileHeaderMap[prefix] !== undefined) return profileHeaderMap[prefix];
                    }
                    return undefined;
                };

                const dataValues = profileSheet.getDataRange().getValues();
                const results = [];
                
                const iId = getProfileIdx(["ID"]);
                const iDataCr = getProfileIdx(["DATA_CRIACAO", "DATA"]);
                const iNome = getProfileIdx(["NOME_PACIENTE", "PACIENTE", "NOME"]);
                const iTelefone = getProfileIdx(["TELEFONE", "CELULAR", "WHATSAPP", "FONE", "TEL", "CONTATO"]);
                const iCpf = getProfileIdx(["CPF"]);
                const iMedico = getProfileIdx(["MEDICO", "PROFISSIONAL", "DOUTOR"]);
                const iEspec = getProfileIdx(["ESPECIALIDADE", "SERVICO"]);
                const iDataCo = getProfileIdx(["DATA_CONSULTA", "DATA_DA_CONSULTA", "DIA"]);
                const iHora = getProfileIdx(["HORARIO", "HORA"]);
                const iTipo = getProfileIdx(["TIPO", "MODALIDADE"]);
                const iCupom = getProfileIdx(["CUPOM", "DESCONTO"]);
                const iPagto = getProfileIdx(["PAGAMENTO", "FORMA_PAGAMENTO"]);
                const iStatus = getProfileIdx(["STATUS", "SITUACAO"]);

                for (let i = 1; i < dataValues.length; i++) {
                    let rowCpf = String(dataValues[i][iCpf] || "").replace(/\D/g, "").padStart(11, '0');
                    if (rowCpf === searchCpf) {
                        results.push({
                            id: String(dataValues[i][iId] || ""),
                            data_criacao: dataValues[i][iDataCr],
                            nome_paciente: dataValues[i][iNome],
                            telefone: dataValues[i][iTelefone],
                            cpf: dataValues[i][iCpf],
                            medico: dataValues[i][iMedico],
                            especialidade: dataValues[i][iEspec],
                            data_consulta: dataValues[i][iDataCo],
                            horario: dataValues[i][iHora],
                            tipo: dataValues[i][iTipo],
                            cupom: dataValues[i][iCupom],
                            pagamento: dataValues[i][iPagto],
                            status: dataValues[i][iStatus] || "Pendente"
                        });
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": results })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // --- AÇÃO: RELATÓRIO GERAL PARA O PAINEL MÉDICO ---
        if (action === 'analytics_report') {
            const analyticsSheet = ss.getSheetByName("Agendamentos");
            if (!analyticsSheet) {
                return ContentService.createTextOutput(JSON.stringify({
                    "result": "error",
                    "message": "Aba 'Agendamentos' não encontrada."
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const analyticsHeaderMap = getHeaderMap(analyticsSheet);
            const getAnalyticsIdx = (variants) => {
                for (let v of variants) {
                    const normV = v.toUpperCase().replace(/[^A-Z0-2_]/g, "");
                    if (analyticsHeaderMap[normV] !== undefined) return analyticsHeaderMap[normV];
                    const prefix = normV.substring(0, 4);
                    if (analyticsHeaderMap[prefix] !== undefined) return analyticsHeaderMap[prefix];
                }
                return undefined;
            };

            const analyticsValues = analyticsSheet.getDataRange().getValues();
            const rows = [];

            const iId = getAnalyticsIdx(["ID"]);
            const iDataCr = getAnalyticsIdx(["DATA_CRIACAO", "DATA"]);
            const iNome = getAnalyticsIdx(["NOME_PACIENTE", "PACIENTE", "NOME"]);
            const iTelefone = getAnalyticsIdx(["TELEFONE", "CELULAR", "WHATSAPP", "FONE", "TEL", "CONTATO"]);
            const iCpf = getAnalyticsIdx(["CPF"]);
            const iMedico = getAnalyticsIdx(["MEDICO", "PROFISSIONAL", "DOUTOR"]);
            const iEspec = getAnalyticsIdx(["ESPECIALIDADE", "SERVICO"]);
            const iDataCo = getAnalyticsIdx(["DATA_CONSULTA", "DATA_DA_CONSULTA", "DIA"]);
            const iHora = getAnalyticsIdx(["HORARIO", "HORA"]);
            const iTipo = getAnalyticsIdx(["TIPO", "MODALIDADE"]);
            const iCupom = getAnalyticsIdx(["CUPOM", "DESCONTO"]);
            const iPagto = getAnalyticsIdx(["PAGAMENTO", "FORMA_PAGAMENTO"]);
            const iStatus = getAnalyticsIdx(["STATUS", "SITUACAO"]);
            const iValor = getAnalyticsIdx(["VALOR", "PRECO", "TOTAL"]);

            for (let i = 1; i < analyticsValues.length; i++) {
                const row = analyticsValues[i];
                const id = iId !== undefined ? String(row[iId] || "") : "";
                const paciente = iNome !== undefined ? row[iNome] : "";
                const medico = iMedico !== undefined ? row[iMedico] : "";
                const especialidade = iEspec !== undefined ? row[iEspec] : "";

                if (!id && !paciente && !medico && !especialidade) continue;

                rows.push({
                    id: id,
                    data_criacao: iDataCr !== undefined ? row[iDataCr] : "",
                    nome_paciente: paciente,
                    telefone: iTelefone !== undefined ? row[iTelefone] : "",
                    cpf: iCpf !== undefined ? row[iCpf] : "",
                    medico: medico,
                    especialidade: especialidade,
                    data_consulta: iDataCo !== undefined ? row[iDataCo] : "",
                    horario: iHora !== undefined ? row[iHora] : "",
                    tipo: iTipo !== undefined ? row[iTipo] : "",
                    cupom: iCupom !== undefined ? row[iCupom] : "",
                    pagamento: iPagto !== undefined ? row[iPagto] : "",
                    status: iStatus !== undefined ? (row[iStatus] || "Pendente") : "Pendente",
                    valor: iValor !== undefined ? row[iValor] : ""
                });
            }

            return ContentService.createTextOutput(JSON.stringify({
                "result": "success",
                "data": rows
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: CANCELAR AGENDAMENTO ---
        if (action === 'cancel') {
            const searchId = String(data.id || "").trim();
            if (!searchId) {
                return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "ID não fornecido." })).setMimeType(ContentService.MimeType.JSON);
            }

            const dataValues = sheet.getDataRange().getValues();
            const iId = getIdx(["ID"]);
            const iStatus = getIdx(["STATUS", "SITUACAO"]);

            if (iId === undefined || iStatus === undefined) {
                return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Colunas ID ou Status não encontradas." })).setMimeType(ContentService.MimeType.JSON);
            }

            for (let i = 1; i < dataValues.length; i++) {
                if (String(dataValues[i][iId]).trim() === searchId) {
                    sheet.getRange(i + 1, iStatus + 1).setValue("Cancelado");
                    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "message": "Agendamento cancelado." })).setMimeType(ContentService.MimeType.JSON);
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Agendamento não encontrado." })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: EDITAR DADOS DO PACIENTE ---
        if (action === 'edit_patient_data') {
            const searchId = String(data.id || "").trim();
            const dataValues = sheet.getDataRange().getValues();
            const iId = getIdx(["ID"]);

            for (let i = 1; i < dataValues.length; i++) {
                if (String(dataValues[i][iId]).trim() === searchId) {
                    const rowNum = i + 1;
                    
                    if (data.nome_paciente) {
                        const col = getIdx(["NOME_PACIENTE", "PACIENTE", "NOME"]);
                        if (col !== undefined) sheet.getRange(rowNum, col + 1).setValue(data.nome_paciente);
                    }
                    if (data.telefone) {
                        const col = getIdx(["TELEFONE", "CELULAR", "WHATSAPP", "FONE", "TEL", "CONTATO"]);
                        if (col !== undefined) sheet.getRange(rowNum, col + 1).setValue(data.telefone);
                    }
                    if (data.cpf) {
                        const col = getIdx(["CPF"]);
                        if (col !== undefined) {
                            const cleaned = String(data.cpf).replace(/\D/g, "").padStart(11, '0');
                            const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                            sheet.getRange(rowNum, col + 1).setValue(formatted);
                        }
                    }
                    
                    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "message": "Dados atualizados." })).setMimeType(ContentService.MimeType.JSON);
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Agendamento não encontrado para edição." })).setMimeType(ContentService.MimeType.JSON);
        }

        // Se chegou ate aqui com alguma action, ela nao foi reconhecida.
        // Evita criar linhas vazias quando uma action nova ainda nao esta publicada.
        if (action) {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "Acao nao reconhecida: " + action
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Evita criar agendamento vazio se o corpo da requisicao veio incompleto.
        const hasAppointmentData = data.nome_paciente || data.telefone || data.medico || data.especialidade || data.data_consulta || data.tipo;
        if (!hasAppointmentData) {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "Dados do agendamento nao informados."
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- FLUXO PADRÃO: CRIAÇÃO DE NOVO REGISTRO (Agendamento ou Lista de Espera) ---
        const newId = "AG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const dataCriacao = new Date();
        
        let cleanedCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');
        const formattedCpf = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

        const lastCol = sheet.getLastColumn() || 15; // Fallback se estiver vazia
        const newRow = new Array(lastCol).fill("");
        
        const setVal = (variants, val) => {
            const index = getIdx(variants);
            if (index !== undefined) newRow[index] = val;
        };

        setVal(["ID"], newId);
        setVal(["DATA_CRIACAO", "DATA"], dataCriacao);
        setVal(["NOME_PACIENTE", "PACIENTE", "NOME"], data.nome_paciente);
        setVal(["TELEFONE", "CELULAR", "WHATSAPP", "FONE", "TEL", "CONTATO"], data.telefone);
        setVal(["CPF"], formattedCpf);
        setVal(["MEDICO", "PROFISSIONAL"], data.medico);
        setVal(["ESPECIALIDADE", "SERVICO"], data.especialidade);
        setVal(["DATA_CONSULTA", "DATA_DA_CONSULTA", "DIA"], data.data_consulta);
        setVal(["HORARIO", "HORA"], data.horario);
        setVal(["TIPO", "MODALIDADE"], data.tipo);
        setVal(["CUPOM"], data.cupom || "");
        setVal(["PAGAMENTO", "FORMA_PAGAMENTO"], data.pagamento || "");
        setVal(["STATUS", "SITUACAO"], data.status || "Pendente");
        setVal(["VALOR", "PRECO", "TOTAL"], data.valor || data.preco || data.total || "");

        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": newId })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
