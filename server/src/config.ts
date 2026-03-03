import path from 'path';

export const config = {
    // Server
    port: process.env.PORT || 3001,

    // Data paths
    dataDir: path.join(__dirname, '..', 'data'),
    atlasDataDir: path.join(__dirname, '..', 'data', 'atlas'),
    s2idDataDir: path.join(__dirname, '..', 'data', 's2id'),
    dbPath: path.join(__dirname, '..', 'data', 'database.sqlite'),

    // Atlas Digital URLs
    atlas: {
        csvUrl: 'https://atlasdigital.mdr.gov.br/arquivos/BD_Atlas_1991_2024_v1.0_2025.04.14_Consolidado.csv',
        xlsxUrl: 'https://atlasdigital.mdr.gov.br/arquivos/BD_Atlas_1991_2024_v1.0_2025.04.14_Consolidado.xlsx',
    },

    // S2ID URLs
    s2id: {
        baseUrl: 'https://s2id.mi.gov.br',
        reportsUrl: 'https://s2id.mi.gov.br/paginas/relatorios/',
    },

    // Puppeteer config
    puppeteer: {
        headless: true,
        timeout: 60000,
        downloadTimeout: 120000,
    },

    // Schedule (cron format)
    schedule: {
        // Daily at 6 AM
        s2idDaily: '0 6 * * *',
        // Weekly on Sunday at 3 AM
        atlasWeekly: '0 3 * * 0',
        // Every hour for health check
        healthCheck: '0 * * * *',
    },

    // Report types to collect from S2ID
    s2idReports: [
        {
            id: 'danos-informados',
            name: 'Relatório Gerencial - Danos informados',
            accordionIndex: 30, // DOM index from exploration
        },
        {
            id: 'reconhecimentos-vigentes',
            name: 'Relatório Gerencial - Reconhecimentos Vigentes',
            accordionIndex: null, // Will find dynamically
        },
        {
            id: 'reconhecimentos-realizados',
            name: 'Relatório Gerencial - Reconhecimentos Realizados',
            accordionIndex: null,
        },
    ],

    // Brazilian states
    states: [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
        'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ],
};

export default config;
