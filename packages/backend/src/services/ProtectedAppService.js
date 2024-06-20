const { get_app } = require("../helpers");
const { UserActorType } = require("./auth/Actor");
const { PermissionImplicator, PermissionUtil, PermissionRewriter } = require("./auth/PermissionService");
const BaseService = require("./BaseService");

class ProtectedAppService extends BaseService {
    async _init () {
        const svc_permission = this.services.get('permission');

        svc_permission.register_rewriter(PermissionRewriter.create({
            matcher: permission => {
                if ( ! permission.startsWith('app:') ) return false;
                const [_, specifier] = PermissionUtil.split(permission);
                if ( specifier.startsWith('uid#') ) return false;
                return true;
            },
            rewriter: async permission => {
                const [_1, name, ...rest] = PermissionUtil.split(permission);
                const app = await get_app({ name });
                return PermissionUtil.join(
                    _1, `uid#${app.uid}`, ...rest,
                );
            },
        }));

        // track: object description in comment
        // Owner of procted app has implicit permission to access it
        svc_permission.register_implicator(PermissionImplicator.create({
            matcher: permission => {
                return permission.startsWith('app:');
            },
            checker: async ({ actor, permission }) => {
                if ( !(actor.type instanceof UserActorType) ) {
                    return undefined;
                }
                
                const parts = PermissionUtil.split(permission);
                if ( parts.length !== 3 ) return undefined;
                
                const [_, uid_part, lvl] = parts;
                if ( lvl !== 'access' ) return undefined;
                
                // track: slice a prefix
                const uid = uid_part.slice('uid#'.length);
                
                const app = await get_app({ uid });

                if ( app.owner_user_id !== actor.type.user.id ) {
                    return undefined;
                }
                
                return {};
            },
        }));
    }
}

module.exports = {
    ProtectedAppService,
};
