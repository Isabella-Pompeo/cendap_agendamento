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

        const idxId = getIdx(["ID", "CHAVE"]);
        const idxCpf = getIdx(["CPF"]);
        
        if (idxId === undefined || idxCpf === undefined) {
            return ContentService.createTextOutput(JSON.stringify({ 
                "result": "error", 
                "message": "Colunas essenciais (ID, CPF) não encontradas.",
                "headers": Object.keys(headerMap)
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- AÇÃO: BUSCAR AGENDAMENTOS POR CPF ---
        if (action === 'list_by_cpf') {
            let searchCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');

            if (searchCpf.length === 11) {
                const dataValues = sheet.getDataRange().getValues();
                const results = [];
                
                const iId = getIdx(["ID"]);
                const iDataCr = getIdx(["DATA_CRIACAO", "DATA"]);
                const iNome = getIdx(["NOME_PACIENTE", "PACIENTE", "NOME"]);
                const iTelefone = getIdx(["TELEFONE", "CELULAR", "WHATSAPP", "FONE", "TEL", "CONTATO"]);
                const iCpf = getIdx(["CPF"]);
                const iMedico = getIdx(["MEDICO", "PROFISSIONAL", "DOUTOR"]);
                const iEspec = getIdx(["ESPECIALIDADE", "SERVICO"]);
                const iDataCo = getIdx(["DATA_CONSULTA", "DATA_DA_CONSULTA", "DIA"]);
                const iHora = getIdx(["HORARIO", "HORA"]);
                const iTipo = getIdx(["TIPO", "MODALIDADE"]);
                const iCupom = getIdx(["CUPOM", "DESCONTO"]);
                const iPagto = getIdx(["PAGAMENTO", "FORMA_PAGAMENTO"]);
                const iStatus = getIdx(["STATUS", "SITUACAO"]);

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

        // --- FLUXO PADRÃO: CRIAÇÃO DE NOVO AGENDAMENTO ---
        const newId = "AG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const dataCriacao = new Date();
        
        let cleanedCpf = String(data.cpf || "").replace(/\D/g, "").padStart(11, '0');
        const formattedCpf = cleanedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

        const lastCol = sheet.getLastColumn();
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

        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": newId })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
