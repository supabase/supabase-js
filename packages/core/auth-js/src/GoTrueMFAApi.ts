export default class GoTrueMFAApi {
    protected url: string
    constructor({
        url = '',
    }) {
        this.url = url
    }
    /**
     * Namespace for the GoTrue MFA methods.
     */
    async unenroll() {
        console.log("hello")
    }
}
