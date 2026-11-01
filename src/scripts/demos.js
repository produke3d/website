document.addEventListener("DOMContentLoaded", async () => {

    const demosDatabaseUrl = "https://raw.githubusercontent.com/produke3d/archives/master/demos.gzip";
    //const demosDatabaseUrl = "https://cdn.jsdelivr.net/gh/produke3d/archives@master/demos.gzip";

    const gzipBytes = await (await fetch(demosDatabaseUrl)).arrayBuffer();
    const stream = new Blob([gzipBytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const demoDatabase = JSON.parse(await new Response(stream).text());

    const trs = [];
    
    const isTeamMode = mode => [2,3,4,5,8].includes(mode);

    const GameMode = {
        DM: 0,
        COOP: 1,
        TDM: 2,
        CTF: 3,
        ONEFCTF: 4,
        ADCTF: 5,
        SURV: 6,
        LMS: 7,
        TLMS: 8,
        TERM: 9
    };

    const gameModeDictionary = Object.keys(GameMode).reduce((dic, key) => {
        dic[GameMode[key]] = key;
        return dic;
    }, []);

    const getMap = demo => {
        if (demo.Volume === 0 && demo.Level === 7) {
            return demo.Map.toUpperCase().replace(".MAP", "");
        } else {
            return `E${demo.Volume+1}L${demo.Level+1}`;
        }
    };

    const getPlayers = demo => {

        const getPlayer = p => {
            let attr = "";
            if (isTeamMode(demo.Mode)) {
                attr = `data-team="${p.Team}"`;
            } else {
                attr = `data-color="${p.Id}"`;
            }
            return `
                <div class="flex-row flex-no-wrap flex-justify-content-center flex-gap-4" ${attr}>
                    <span>${p.Name}</span>
                    <span>[${p.Score}]</span>
                </div>
            `;            
        };

        let players = [];

        if (isTeamMode(demo.Mode)) {
            players = demo.Players.sort((a,b) => a.Team - b.Team).map(p => getPlayer(p));
        } else {
            players = demo.Players.sort((a,b) => a.Id - b.Id).map(p => getPlayer(p));
        }

        return `
            <div class="grid">${players.join("")}</div>
        `;

    };

    const getWinner = demo => {

        const winners = demo.Players.filter(p => p.Winner);

        if (isTeamMode(demo.Mode)) {

            const winnerTeams = new Set(winners.map(p => p.Team));
            if (winnerTeams.size > 1) {
                return "DRAW";
            } else {
                switch (winnerTeams.values().next().value) {
                    case 1: return `<span data-team="1">BLUE</span>`;
                    case 2: return `<span data-team="2">RED</span>`;
                    case 3: return `<span data-team="3">GREEN</span>`;
                    case 4: return `<span data-team="4">BROWN</span>`;
                }
            }

        } else {
            if (winners.length > 1) {
                return "DRAW";
            } else {
                return `<span data-color="${winners[0].Id}">${winners[0].Name}</span>`;
            }
        }

    };

    for (const demo of demoDatabase.sort((a,b) => new Date(b.StartDateTime) - new Date(a.StartDateTime))) {
        trs.push(`
            <tr>
                <td style="white-space: nowrap;">${demo.StartDateTime.replace(" ", "<br>")}</td>
                <td style="white-space: nowrap;">${gameModeDictionary[demo.Mode]}</td>
                <td>${getMap(demo)}</td>
                <td style="white-space: nowrap;">${getPlayers(demo)}</td>
                <td style="white-space: nowrap;">${demo.Duration}</td>
                <!-- <td style="white-space: nowrap;">${getWinner(demo)}</td> -->
            </tr>
        `);
    }

    document.querySelector("table#demos > tbody").insertAdjacentHTML("afterbegin", trs.join(""));

});