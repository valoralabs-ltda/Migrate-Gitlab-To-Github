module.exports = {
    replaceAsync,
    getUrlExtension
}

async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

function getUrlExtension(url) {
    return url.split(/\#|\?/)[0].split('.').pop().trim();
}