/**
 * Safely creates a RegExp object from a string pattern.
 * If the pattern is invalid, it returns a regex that matches nothing.
 */
export const safeRegex = (pattern: string, flags: string = ''): RegExp => {
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        console.warn(`Invalid regex pattern: "${pattern}"`, e);
        // Return a regex that matches nothing
        return /.^/;
    }
};
