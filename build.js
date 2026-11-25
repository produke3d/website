// this is one of the nastiest scripts i've ever writen in my life -lard

const fs = require("fs");
const path = require("path");

const langs = ["en", "pt"];

const domain = process.argv[2];
const commonFolder = `${domain}/$common`;

function GetTranslatedPageId(path, lang) {
    return fs.readFileSync(path, "utf-8")
        .match(new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i'))[1]                    
        .toLowerCase()                    
        .replace(/\(.*?\)/, "")
        .trim()
        .replace(/ /g, "-")
        .replace(/\//g, "-")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
    ;
}

function BuildAlternateLinksDictionary() {

    const dictionary = {};

    const walk = (dir, lang, currentDir, level) => {

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {

            if (entry.name.match(/\{.*?\}\.html$/)) continue;

            const id = entry.name.split("#")[1].replace(".html", "");

            if (!dictionary[id]) {
                dictionary[id] = {};
            }          

            if (entry.isDirectory()) {
                // if we are at level three
                // threat directory as a single page
                // because all .html files will be merged into one
                if (level === 3) {
                    const path = `${entry.parentPath}/${entry.name}/{${entry.name.split("#")[1]}.html}`;
                    const translatedPageId = GetTranslatedPageId(path, lang);
                    dictionary[id][lang] = `${domain}/${lang}/${currentDir}/${translatedPageId}/`;
                } else {
                    const path = `${entry.parentPath}/${entry.name}/{${id}}.html`;
                    const translatedPageId = GetTranslatedPageId(path, lang);
                    dictionary[id][lang] = `${domain}/${lang}/${currentDir}${currentDir !== "" ? "/" : ""}${translatedPageId}/`;
                    walk(`${dir}/${entry.name}`, lang, `${currentDir}${currentDir !== "" ? "/" : ""}${translatedPageId}`, level + 1);
                }
            } else {
                const path = `${entry.parentPath}/${entry.name}`;
                const translatedPageId = GetTranslatedPageId(path, lang);
                dictionary[id][lang] = `${domain}/${lang}/${currentDir}/${translatedPageId}/`;
            }

        }

    };

    for (const lang of langs) {
        walk("src/pages/{lang}", lang, "", 0);
    }    

    return dictionary;

}

const alternateLinkDictionary = BuildAlternateLinksDictionary();

function BuildMenuDictionary() {

    const buildMenuHtml = (folder, lang, isThirdLevel) => {

        const lis = [];

        const root = fs.readFileSync(`${folder}/{${folder.split("/").pop().split("#")[1]}}.html`, "utf-8");

        const title = root.match(new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i'))[1];

        const files = fs.readdirSync(folder, {withFileTypes: true}).filter(e => !isThirdLevel ? !e.isDirectory() : true);

        for (const file of files) {
            if (file.name.match(/\{.*?\}\.html$/)) continue;

            // if we are in the third level and current file is a folder
            // we threat it as a single menu entry
            // because all .html files will be merged into one
            if (isThirdLevel && file.isDirectory()) {
                const id = file.name.split("#")[1];
                const link = alternateLinkDictionary[id][lang];
                const content = fs.readFileSync(`${folder}/${file.name}/{${id}}.html`, "utf-8");
                const name = content.match(new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i'))[1];
                lis.push(`<li><a href="${link}">${name}</a></li>`);
            } else {
                const id = file.name.split("#")[1].replace(".html", "");
                const link = alternateLinkDictionary[id][lang];
                const content = fs.readFileSync(`${folder}/${file.name}`, "utf-8");
                const name = content.match(new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i'))[1];
                lis.push(`<li><a href="${link}">${name}</a></li>`);
            }

        }

        return `
            <div class="menu">
                <strong>${title.toUpperCase()}</strong>
                <ul>${lis.join("\n")}</ul>
            </div>
        `;

    };

    const dictionary = {};

    const rootFolders = fs.readdirSync("src/pages/{lang}", { withFileTypes: true }).filter(entry => entry.isDirectory()).map(e => e.name);

    for (const folder of rootFolders) {

        const folderId = folder.split("#")[1];

        if (!dictionary[folderId]) dictionary[folderId] = {}

        for (const lang of langs) {

            const menusHtmls = [];

            // we will only process the 2nd and 3rd levels so we don't need recursion here

            const entries = fs.readdirSync(`src/pages/{lang}/${folder}`, { withFileTypes: true });

            // if second level has any html files that are not root => we need to build a menu for it
            if (entries.some(e => !e.isDirectory() && !e.name.match(/\{.*?\}\.html$/))) {
                menusHtmls.push(buildMenuHtml(`src/pages/{lang}/${folder}`, lang, false));
            }

            // if second level has any folder => generate 3rd level menus
            if (entries.some(e => e.isDirectory())) {
                for (const entry of entries.filter(e => e.isDirectory())) {
                    menusHtmls.push(buildMenuHtml(`src/pages/{lang}/${folder}/${entry.name}`, lang, true));
                }
            }

            dictionary[folderId][lang] = menusHtmls.join("\n");

        }

    }

    return dictionary;

}

const menuDictionary = BuildMenuDictionary();

function CreateBinFolder() {

    // remove bin folder if it exists
    if (fs.existsSync("bin")) {
        fs.rmSync("bin", { recursive: true, force: true });
    }

    // create clean bin folder
    fs.mkdirSync("bin");

}

function copyCNAME() {
    fs.cpSync("CNAME", "bin/CNAME");
}

function CopyCommonFiles() {

    // copy lib, res and src folders to bin/$common folder
    fs.cpSync("lib", "bin/$common/lib", { recursive: true });
    fs.cpSync("res", "bin/$common/res", { recursive: true });
    fs.cpSync("src", "bin/$common/src", { recursive: true });

    // we will copy the pages to each corresponding lang folder latter
    fs.rmSync("bin/$common/src/pages", { recursive: true, force: true });

    // copy landing page to bin folder
    fs.cpSync("src/pages/{landing-page}.html", "bin/index.html");

}

function CopyPagesToLangFolders() {

    // copy pages to each lang folder
    for (const lang of langs) {
        fs.cpSync("src/pages/{lang}", `bin/${lang}`, { recursive: true });
    }

}

function RemoveOrderFromFilesAndFolderNames() {

    const remove = (currentSrc) => {
        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
            const srcFile = currentSrc + "/" + entry.name;
            if (entry.name.includes("#")) {
                fs.renameSync(srcFile, currentSrc + "/" + entry.name.split("#")[1]);
            }
            if (entry.isDirectory()) {
                rename(srcFile);
            }
        }
    }

    // remove # from files and folder names recursively
    for (const lang of langs) {        
        remove(`bin/${lang}`);
    }

}

function RenameHtmlFilesToIndex() {

    const regex = /\{.*?\}\.html$/;

    const rename = (currentSrc, lang, level) => {

        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {

            const srcFile = currentSrc + "/" + entry.name;

            if (entry.isDirectory()) {

                if (level < 3) {

                    rename(srcFile, lang, level + 1);      

                } else {

                    // if we are at the third level
                    // we treat the folder as a single page
                    // because all .html files will be merged into one index.html
                    // we need to create a single index.html file with all children merged
                    // each children will be placed inside a <section> tag
                    // we also need to use the {}.html file as the header of this html
                    // we also need to delete other files
                    const contents = [];

                    const pageId = entry.name.split("#")[1];

                    // first we use the {}.html as the header of this file
                    contents.push(fs.readFileSync(`${currentSrc}/${entry.name}/{${pageId}}.html`, "utf-8"));
                    
                    for (const file of fs.readdirSync(`${currentSrc}/${entry.name}`)) {

                        // ignore header file we already read
                        if (file.match(regex)) continue;

                        const path = `${currentSrc}/${entry.name}/${file}`;

                        const translatedPageId = GetTranslatedPageId(path, lang);

                        const content = fs.readFileSync(path, "utf-8");

                        const translatedTitle = fs.readFileSync(path, "utf-8").match(new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i'))[1];

                        contents.push(`
                            <section id="${translatedPageId}" style="padding-top: 32px;">
                                <div class="flex-rows flex-gap-32">
                                    <h2>${translatedTitle} <a href="#${translatedPageId}">#</a></h2>
                                    <hr style="margin: 0px;">
                                    ${content
                                        // remove titles
                                        .replace(
                                            new RegExp(
                                                `<title\\b[^>]*\\blang="${lang}"[^>]*>([\\s\\S]*?)<\\/title>`,
                                                "gi"
                                            ),
                                            ""
                                        )
                                    }
                                </div>
                            </section>    
                        `);

                        fs.rmSync(`${currentSrc}/${entry.name}/${file}`);

                    }                    

                    // after everything is built, create index.html in this directory
                    fs.writeFileSync(`${currentSrc}/${entry.name}/index.html`, contents.join("\n"));                    

                }

            } else if (entry.name.endsWith(".html")) {

                if (entry.name.match(regex)) {
                    // if file is {}.html, rename it to index.html
                    fs.renameSync(srcFile, srcFile.replace(regex, "index.html"));
                } else {
                    // if file is not {}.html, move it to filename/index.html
                    const dirName = path.dirname(srcFile);
                    const fileName = path.basename(srcFile, ".html");
                    fs.mkdirSync(`${dirName}/${fileName}`, { recursive: true });
                    fs.renameSync(srcFile, `${dirName}/${fileName}/index.html`);
                }         

            }

        }

    }

    // rename all {}.html files to index.html recusively
    for (const lang of langs) {        
        rename(`bin/${lang}`, lang, 1);
    }

}

function BuildNavbar() {

    const html = [];

    // for the navbar we only want to iterate the root of the {lang} folder
    const rootFolders = fs.readdirSync("src/pages/{lang}", { withFileTypes: true }).filter(entry => entry.isDirectory());

    for (const folder of rootFolders) {
        const folderName = folder.name.split("#")[1];
        const indexHtmlPath = `src/pages/{lang}/${folder.name}/{${folderName}}.html`;
        const indexHtmlContent = fs.readFileSync(indexHtmlPath, "utf-8");
        const links = [];
        for (const lang of langs) {
            const titleTagRegex = new RegExp(`<title\\s+lang="${lang}">(.*?)<\\/title>`, 'i');
            const titleTagMatch = indexHtmlContent.match(titleTagRegex)[1];
            const link = menuDictionary[folderName][lang].match(/href=["']([^"']+)["']/i)[1];
            links.push(`
                <a href="${link}" lang="${lang}">${titleTagMatch}</a>
            `);
        }
        html.push(links.join(""));
    }

    return html.join(`<span class="separator"></span>`);

}

function AddCommonHtmlToPages() {

    // get content of common index.html
    const rawIndexHtml = fs.readFileSync("index.html", "utf-8");

    // replace navbar in common index.html
    const navbar = BuildNavbar();
    const commonIndexHtml = rawIndexHtml.replace("{links}", navbar);

    const walk = (currentSrc, lang) => {

        const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

        for (const entry of entries) {   

            const srcFile = currentSrc + "/" + entry.name;

            if (entry.isDirectory()) {
                walk(srcFile, lang);
                continue;
            }

            // get content of current html file
            const currentHtml = fs.readFileSync(srcFile, "utf-8");   
            
            let alternatesHtml = [];
            
            const pageId = entry.parentPath.split("/").pop();
            // if home index.html
            if (pageId === lang) {
                for (const l of langs) {
                    alternatesHtml.push(`<link rel="alternate" hreflang="${l}" href="${domain}/${l}/" />`);
                }
            } else {
                const alternateLinks = alternateLinkDictionary[pageId.split("#")[1]];
                alternatesHtml = Object.keys(alternateLinks)
                    .map(k => `<link rel="alternate" hreflang="${k}" href="${alternateLinks[k]}" />`)
                ;
            }

            let menuHtml = "";

            // if not home index.html
            if (pageId !== lang) {

                // get main page id
                const firstLevelPageName = srcFile.split("/")[2].split("#")[1];

                // menuHtml = `
                //     <div class="flex-rows flex-gap-32">
                //         ${menuDictionary[firstLevelPageName][lang]}
                //         <button id="back-to-top"></button>
                //     </div>
                // `;

                menuHtml = `
                    <div class="menu-box">
                        ${menuDictionary[firstLevelPageName][lang]}
                    </div>
                `;

            }

            // replace placeholder on common html
            const replacedHtml = commonIndexHtml
                .replace("{menu}", menuHtml)
                .replace("{content}", `<div id="${pageId === lang ? "home" : pageId}" class="box flex-rows flex-gap-32">${currentHtml}</div>`)
                .replace("{alternates}", alternatesHtml.join("\n"))
            ;
            fs.writeFileSync(srcFile, replacedHtml, "utf-8");

        }
        
    };

    for (const lang of langs) {
        walk(`bin/${lang}`, lang);
    }
}

function TranslateFoldersNames() {

    const regex = /\{.*?\}\.html$/;

    const translate = (currentSrc, lang) => {        
        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                const translatedPageId = GetTranslatedPageId(currentSrc + "/" + entry.name + "/index.html", lang)
                fs.renameSync(currentSrc + "/" + entry.name, currentSrc + "/" + translatedPageId);
                translate(currentSrc + "/" + translatedPageId, lang);
            } 
        }
    }

    // iterate each lang folder
    for (const lang of langs) {
        translate(`bin/${lang}`, lang);
    }

}

function FilterLangTags() {

    const filter = (currentSrc, lang) => {
        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                filter(currentSrc + "/" + entry.name, lang);
            } else {
                const srcFile = currentSrc + "/" + entry.name;
                if (!srcFile.endsWith(".html")) continue;
                const html = fs.readFileSync(srcFile, "utf-8");
                const filteredHtml = html
                    .replace(new RegExp(`\\{lang\\}`, 'gi'), lang)
                    .replace(
                        new RegExp(
                            `<title\\b[^>]*\\blang="${lang}"[^>]*>([\\s\\S]*?)<\\/title>`,
                            "gi"
                        ),
                        `<h1 lang="${lang}">$1</h1><hr>`
                    )
                    .replace(new RegExp(`<([a-z0-9]+)\\b[^>]*\\blang="(?!${lang}")[^"]+"[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi'), '')
                    .replace(new RegExp(`<([a-z0-9]+)\\b[^>]*\\blang="(?!${lang}")[^"]+"[^>]*\\/?>`, 'gi'), '')
                    .replace(new RegExp(`(<(?!html)[a-z0-9]+\\b[^>]*)(\\s+lang="[^"]+")([^>]*>)`, 'gi'), '$1$3')
                ;
                fs.writeFileSync(srcFile, filteredHtml, "utf-8");
            }
        }
    }

    // iterate each lang folder
    // replace all instance of {lang} with the corresponding lang
    // remove all other lang tags
    for (const lang of langs) {
        filter(`bin/${lang}`, lang);
    }

}

function ReplaceCommonPath() {

    const walk = (currentSrc) => {

        const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

        for (const entry of entries) {

            const srcFile = currentSrc + "/" + entry.name;

            if (entry.isDirectory()) {
                walk(srcFile);
                continue;
            }

            if (
                !srcFile.endsWith(".html") 
                && !srcFile.endsWith(".js")
                && !srcFile.endsWith(".css")
            ) continue;

            const html = fs.readFileSync(srcFile, "utf-8");

            const replacedHtml = html
                .replace(/\{domain\}/g, domain)    
                .replace(/\{\$common\}/g, commonFolder)
            ;

            fs.writeFileSync(srcFile, replacedHtml, "utf-8");

        }

    };

    walk("bin");

}

function GenerateSitemap() {

    const sitemapUrls = [];

    // Home pages
    for (const lang of langs) {

        const alternateLinks = langs
            .map(l => `            <xhtml:link rel="alternate" hreflang="${l}" href="${domain}/${l}/" />`)
            .join("\n");

        sitemapUrls.push(`
    <url>
        <loc>${domain}/${lang}/</loc>
${alternateLinks}
    </url>`);
    }

    // All other pages
    for (const pageId of Object.keys(alternateLinkDictionary)) {

        const alternateLinks = alternateLinkDictionary[pageId];

        for (const lang of langs) {

            // Skip the page if this language does not exist
            if (!alternateLinks[lang]) continue;

            const links = langs
                .filter(l => alternateLinks[l])
                .map(l => `            <xhtml:link rel="alternate" hreflang="${l}" href="${alternateLinks[l]}" />`)
                .join("\n");

            sitemapUrls.push(`
    <url>
        <loc>${alternateLinks[lang]}</loc>
${links}
    </url>`);
        }
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrls.join("\n")}
</urlset>
`;

    fs.writeFileSync("bin/sitemap.xml", sitemap, "utf-8");
    
}

CreateBinFolder();
copyCNAME();
CopyCommonFiles();
CopyPagesToLangFolders();
RenameHtmlFilesToIndex();
AddCommonHtmlToPages();
TranslateFoldersNames();
FilterLangTags();
ReplaceCommonPath();
GenerateSitemap();