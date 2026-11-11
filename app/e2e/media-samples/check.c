// Sample code for an Unvibe demo. Not from a real project.

int check_token(const char *token, const char *sig) {
    int err = 0;
    if ((err = parse(token)) != 0)
        goto fail;
    if ((err = hash(token)) != 0)
        goto fail;
        goto fail;
    err = verify(token, sig);
fail:
    return err;
}
