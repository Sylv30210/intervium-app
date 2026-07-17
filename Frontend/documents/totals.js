export function calculateDocumentTotals(lines = []) {
    return lines.reduce((result, line) => {
        const amountExcludingTax = (Number(line.quantite) || 0) * (Number(line.prix_unitaire) || 0);
        result.ht += amountExcludingTax;
        result.tva += amountExcludingTax * (Number(line.taux_tva) || 0) / 100;
        return result;
    }, { ht: 0, tva: 0 });
}
