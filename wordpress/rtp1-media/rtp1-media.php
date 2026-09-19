<?php
/**
 * Plugin Name: ROAD TO P1 Media — Brouillons sécurisés
 * Description: Brouillons Elementor, aperçu isolé, validation explicite et retour arrière.
 * Version: 1.1.0
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) { exit; }

final class RTP1_Media {
    const NS = 'rtp1-media/v1';
    const CSS_PROPERTIES = ['color','background-color','font-size','font-weight','line-height','letter-spacing','text-align','padding','padding-top','padding-right','padding-bottom','padding-left','margin','margin-top','margin-right','margin-bottom','margin-left','min-height','max-height','height','width','max-width','gap','row-gap','column-gap','border-radius','display'];

    public static function table() { global $wpdb; return $wpdb->prefix . 'rtp1_media_drafts'; }
    public static function install() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table(); $collate = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            id varchar(36) NOT NULL,
            page_id bigint(20) unsigned NOT NULL,
            owner_id bigint(20) unsigned NOT NULL,
            state varchar(20) NOT NULL,
            payload longtext NOT NULL,
            receipt longtext NOT NULL,
            review_hash varchar(64) NOT NULL DEFAULT '',
            created_at bigint(20) NOT NULL,
            expires_at bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            KEY page_state (page_id,state)
        ) ENGINE=InnoDB $collate;");
    }
    public static function error($message, $status = 400) { throw new RuntimeException($message, $status); }
    public static function permission() { return current_user_can('edit_pages') && current_user_can('publish_pages'); }
    public static function routes() {
        $routes = [
            '/capabilities'=>['GET','capabilities'], '/pages'=>['GET','pages'], '/history'=>['GET','history'],
            '/snapshot/(?P<id>\d+)'=>['GET','snapshot_route'], '/draft/(?P<id>[a-f0-9-]{36})'=>['GET','read_draft'],
            '/draft'=>['POST','draft'], '/preview'=>['POST','preview'], '/apply'=>['POST','apply'],
            '/rollback'=>['POST','rollback'], '/reject'=>['POST','reject'], '/quota'=>['POST','quota']
        ];
        foreach ($routes as $route=>$entry) {
            register_rest_route(self::NS, $route, ['methods'=>$entry[0], 'permission_callback'=>[__CLASS__,'permission'],
                'callback'=>function($request) use ($entry) {
                    try { $data = call_user_func([__CLASS__, $entry[1]], $request); return new WP_REST_Response($data, 200, ['Cache-Control'=>'no-store']); }
                    catch (Throwable $e) { $code = $e->getCode(); return new WP_Error('rtp1_media', $code >= 400 && $code < 600 ? $e->getMessage() : 'Opération interrompue. Aucune nouvelle tentative automatique.', ['status'=>$code >= 400 && $code < 600 ? $code : 500]); }
                }]);
        }
    }
    private static function check_page($id) {
        $post = get_post($id);
        if (!$post || $post->post_type !== 'page' || $post->post_status !== 'publish' || !current_user_can('edit_post', $id)) self::error('Page publiée inaccessible.',403);
        if (!did_action('elementor/loaded')) self::error('Elementor doit être actif.',503);
        return $post;
    }
    private static function engines() {
        global $wpdb;
        foreach ([$wpdb->posts, $wpdb->postmeta, self::table()] as $table) {
            $engine = $wpdb->get_var($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', $table));
            if (strtoupper((string)$engine) !== 'INNODB') self::error('Publication bloquée : le stockage transactionnel doit être disponible.',503);
        }
    }
    public static function capabilities() {
        self::engines();
        if (!class_exists('DOMDocument')) self::error('Le moteur d’aperçu DOM manque sur WordPress.',503);
        if (!did_action('elementor/loaded')) self::error('Elementor doit être actif.',503);
        return ['ok'=>true,'version'=>'1.1.0','mode'=>'draft-review-apply','backup'=>true,'atomicConflictCheck'=>true];
    }
    public static function pages() {
        $pages = get_posts(['post_type'=>'page','post_status'=>'publish','numberposts'=>-1,'orderby'=>'menu_order','order'=>'ASC','suppress_filters'=>true]);
        return ['ok'=>true,'pages'=>array_values(array_map(function($p) { return ['id'=>$p->ID,'title'=>get_the_title($p),'link'=>get_permalink($p),'slug'=>$p->post_name,'modified'=>$p->post_modified_gmt]; }, array_filter($pages, fn($p)=>current_user_can('edit_post',$p->ID))))];
    }
    // SQL reads avoid an object cache hiding edits performed by another request.
    private static function snapshot($id, $lock = false) {
        global $wpdb;
        self::check_page($id);
        $suffix = $lock ? ' FOR UPDATE' : '';
        $post = $wpdb->get_row($wpdb->prepare("SELECT ID,post_title,post_content,post_excerpt,post_status,post_name,post_modified,post_modified_gmt FROM {$wpdb->posts} WHERE ID=%d" . $suffix,$id),ARRAY_A);
        if (!$post || $post['post_status'] !== 'publish') self::error('Cette page n’est plus publiée.',409);
        $rows = $wpdb->get_results($wpdb->prepare("SELECT meta_id,meta_key,meta_value FROM {$wpdb->postmeta} WHERE post_id=%d ORDER BY meta_id" . $suffix,$id),ARRAY_A);
        $meta = []; $data_rows = [];
        foreach ($rows as $row) {
            if ($row['meta_key'] === '_elementor_data') $data_rows[] = $row;
            if (in_array($row['meta_key'],['_elementor_data','_elementor_page_settings','_elementor_edit_mode','_elementor_template_type','_wp_page_template'],true)) $meta[] = $row;
        }
        if (count($data_rows) !== 1) self::error('Données Elementor absentes ou dupliquées.',422);
        $data = json_decode($data_rows[0]['meta_value'],true,128,JSON_THROW_ON_ERROR);
        if (!is_array($data) || !$data) self::error('Page Elementor vide.',422);
        return ['revision'=>hash('sha256',wp_json_encode([$post,$meta])), 'page'=>['id'=>$id,'title'=>$post['post_title'],'link'=>get_permalink($id),'modified'=>$post['post_modified_gmt']], 'data'=>$data,'raw'=>$data_rows[0]['meta_value'],'metaId'=>(int)$data_rows[0]['meta_id']];
    }
    private static function control_allowed($key, $control) {
        // Deliberately exclude custom code, repeaters, templates, dynamic/global bindings and arbitrary attributes.
        $base = preg_replace('/_(mobile|tablet)$/','',$key);
        if (!preg_match('/^(min_height|height|width|content_width|boxed_width|padding|margin|_padding|_margin|flex_gap|flex_direction|flex_justify_content|flex_align_items|background_background|background_color|title_color|text_color|button_text_color|background_color|typography_typography|typography_font_size|typography_font_weight|typography_line_height|align|hide_desktop|hide_tablet|hide_mobile|title|text|editor|link)$/',$base)) return false;
        return in_array($control['type'] ?? '', ['text','textarea','wysiwyg','slider','dimensions','color','select','choose','switcher','url'],true);
    }
    private static function catalogue($nodes, $page_id, $parent = '', &$seen = []) {
        $result = [];
        foreach ($nodes as $node) {
            $id = $node['id'] ?? '';
            if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/',$id) || isset($seen[$id])) self::error('Identifiant Elementor invalide ou dupliqué.',422);
            $seen[$id] = true;
            $instance = \Elementor\Plugin::$instance->elements_manager->create_element_instance($node);
            if (!$instance) self::error('Élément Elementor non pris en charge.',422);
            $controls = [];
            foreach ($instance->get_controls() as $key=>$control) {
                if (!self::control_allowed($key,$control)) continue;
                // Content controls only for native known widgets; HTML content has its own narrow operations.
                if (in_array($key,['title','text','editor','link'],true) && !in_array($node['widgetType'] ?? '',['heading','button','text-editor'],true)) continue;
                if (!empty($node['settings']['__globals__'][$key]) || !empty($node['settings']['__dynamic__'][$key])) continue;
                $controls[$key] = array_filter(['type'=>$control['type'],'label'=>wp_strip_all_tags($control['label'] ?? $key),'default'=>$control['default'] ?? null,'options'=>$control['options'] ?? null,'units'=>$control['size_units'] ?? null,'range'=>$control['range'] ?? null,'condition'=>$control['condition'] ?? null,'return_value'=>$control['return_value'] ?? null],fn($v)=>$v!==null);
            }
            $item = ['id'=>$id,'parent'=>$parent,'type'=>$node['widgetType'] ?? $node['elType'],'label'=>$node['settings']['_title'] ?? $instance->get_title(),'settings'=>array_intersect_key($node['settings'] ?? [],$controls),'controls'=>$controls];
            if (($node['widgetType'] ?? '') === 'html') {
                $html = $node['settings']['html'] ?? '';
                $dom = self::dom($html); $xpath = new DOMXPath($dom); $texts = []; $selectors = [];
                foreach ($xpath->query('//text()[not(ancestor::style) and not(ancestor::script)]') as $text) { if (trim($text->nodeValue) !== '') $texts[] = $text->nodeValue; }
                foreach ($xpath->query('//*[@class or @id]') as $el) {
                    foreach (preg_split('/\s+/',trim($el->getAttribute('class'))) as $class) if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_-]*$/',$class)) $selectors[] = '.'.$class;
                    if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_-]*$/',$el->getAttribute('id'))) $selectors[] = '#'.$el->getAttribute('id');
                }
                // A style inside an HTML widget can target its actual ancestor container.
                if ($parent) $selectors[] = '.elementor-'.$page_id.' .elementor-element.elementor-element-'.$parent;
                $css = []; foreach ($dom->getElementsByTagName('style') as $style) $css[] = $style->textContent;
                $item['html'] = ['texts'=>array_values(array_unique($texts)),'selectors'=>array_values(array_unique($selectors)),'css'=>implode("\n",$css),'properties'=>self::CSS_PROPERTIES];
            }
            $result[] = $item;
            $result = array_merge($result,self::catalogue($node['elements'] ?? [],$page_id,$id,$seen));
        }
        return $result;
    }
    public static function snapshot_route($request) {
        $snap = self::snapshot((int)$request['id']);
        return ['ok'=>true,'page'=>$snap['page'],'revision'=>$snap['revision'],'elements'=>self::catalogue($snap['data'],$snap['page']['id'])];
    }
    private static function dom($html) {
        $dom = new DOMDocument('1.0','UTF-8'); $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET); libxml_clear_errors(); libxml_use_internal_errors($previous);
        foreach (iterator_to_array($dom->childNodes) as $child) if ($child->nodeType === XML_PI_NODE) $dom->removeChild($child);
        return $dom;
    }
    private static function value($raw, $control) {
        $v = json_decode($raw,true,16,JSON_THROW_ON_ERROR); $type = $control['type'];
        if (in_array($type,['text','textarea','wysiwyg'],true)) {
            if (!is_string($v) || strlen($v)>10000 || strpos($v,'[')!==false || $v !== wp_strip_all_tags($v)) self::error('Le texte doit être sans code ni balises.',422);
        } elseif (in_array($type,['select','choose'],true)) {
            if (!is_string($v) || !array_key_exists($v,$control['options'] ?? [])) self::error('Option Elementor invalide.',422);
        } elseif ($type === 'switcher') {
            if (!is_string($v) || !in_array($v,['',$control['return_value'] ?? 'yes'],true)) self::error('Visibilité invalide.',422);
        } elseif ($type === 'color') {
            if (!is_string($v) || !preg_match('/^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/',$v)) self::error('Couleur invalide.',422);
        } elseif ($type === 'url') {
            if (!is_array($v) || array_diff(array_keys($v),['url','is_external','nofollow']) || !is_string($v['url'] ?? null) || !preg_match('~^(https://[^\s<>"\x00-\x20]+|#[a-zA-Z0-9_-]+)$~',$v['url'])) self::error('Lien invalide : HTTPS ou ancre requis.',422);
            foreach (['is_external','nofollow'] as $key) if (isset($v[$key]) && !in_array($v[$key],['','on',true,false],true)) self::error('Option de lien invalide.',422);
        } elseif (in_array($type,['slider','dimensions'],true)) {
            if (!is_array($v) || !in_array($v['unit'] ?? '',$control['units'] ?? ['px'],true) || !in_array($v['unit'],['px','%','em','rem','vh','vw'],true)) self::error('Unité Elementor invalide.',422);
            $keys = $type==='slider' ? ['unit','size','sizes'] : ['unit','top','right','bottom','left','isLinked'];
            if (array_diff(array_keys($v),$keys)) self::error('Champs de taille invalides.',422);
            foreach ($type==='slider'?['size']:['top','right','bottom','left'] as $key) {
                if (!isset($v[$key]) || !is_numeric($v[$key]) || (float)$v[$key] < -1000 || (float)$v[$key]>3000) self::error('Taille hors limites.',422);
            }
            if (isset($v['isLinked']) && !is_bool($v['isLinked'])) self::error('Liaison des tailles invalide.',422);
            if (isset($v['sizes']) && $v['sizes'] !== []) self::error('Tailles multiples non prises en charge.',422);
            $range = $control['range'][$v['unit']] ?? [];
            if ($type==='slider' && ((isset($range['min']) && $v['size']<$range['min']) || (isset($range['max']) && $v['size']>$range['max']))) self::error('Taille hors plage Elementor.',422);
        } else self::error('Contrôle non pris en charge.',422);
        return $v;
    }
    private static function &find(&$nodes,$id) {
        foreach ($nodes as &$node) {
            if (($node['id'] ?? '') === $id) return $node;
            if (!empty($node['elements'])) { $found =& self::find($node['elements'],$id); if ($found !== null) return $found; }
        }
        $null = null; return $null;
    }
    private static function make_changes($snap,$changes,$scope) {
        if (!is_array($changes) || count($changes)<1 || count($changes)>12) self::error('Brouillon vide ou trop volumineux.',422);
        $data = $snap['data']; $catalog = array_column(self::catalogue($data,$snap['page']['id']),null,'id'); $diff = []; $seen = [];
        foreach ($changes as $c) {
            foreach (['kind','elementId','key','selector','device','value','reason'] as $key) if (!isset($c[$key]) || !is_string($c[$key]) || strlen($c[$key])>10000) self::error('Structure de modification invalide.',422);
            $item = $catalog[$c['elementId']] ?? null;
            if (!$item || !in_array($c['device'],['all','desktop','tablet','mobile'],true)) self::error('Élément ou affichage invalide.',422);
            if ($scope !== 'all' && $scope !== $c['device']) self::error('Le brouillon dépasse l’affichage demandé.',422);
            $identity = implode('|',[$c['elementId'],$c['kind'],$c['key'],$c['selector'],$c['device']]);
            if (isset($seen[$identity])) self::error('Modification répétée dans le brouillon.',422); $seen[$identity] = true;
            $node =& self::find($data,$c['elementId']); $before = null; $after = null;
            if ($c['kind'] === 'setting') {
                $control = $item['controls'][$c['key']] ?? null; if (!$control) self::error('Réglage Elementor non autorisé.',422);
                $expected = preg_match('/_mobile$/',$c['key']) || $c['key']==='hide_mobile' ? 'mobile' : ((preg_match('/_tablet$/',$c['key']) || $c['key']==='hide_tablet') ? 'tablet' : ($c['key']==='hide_desktop'?'desktop':'all'));
                if ($c['device'] !== $expected) self::error('Affichage incompatible avec le réglage.',422);
                $before = $node['settings'][$c['key']] ?? null; $after = self::value($c['value'],$control);
                if ($before === $after) self::error('Ce réglage possède déjà la valeur demandée.',422);
                $node['settings'][$c['key']] = $after;
                $label = $control['label'];
            } elseif ($c['kind'] === 'html_text') {
                if ($c['device'] !== 'all' || !in_array($c['key'],$item['html']['texts'] ?? [],true) || $c['value'] !== wp_strip_all_tags($c['value']) || strpbrk($c['value'],'<>[]') !== false) self::error('Remplacement de texte HTML invalide.',422);
                $html = $node['settings']['html'];
                // Replace only a whole, unique text node, preserving every other byte including scripts/styles.
                $count = 0;
                $next = preg_replace_callback('~(<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<[^>]+>)|([^<]+)~is',function($m) use ($c,&$count) {
                    if (!empty($m[1])) return $m[0];
                    if (html_entity_decode($m[2],ENT_QUOTES|ENT_HTML5,'UTF-8') !== $c['key']) return $m[0];
                    $count++; return htmlspecialchars($c['value'],ENT_NOQUOTES|ENT_SUBSTITUTE,'UTF-8');
                },$html);
                if ($count !== 1) self::error('Texte absent ou présent plusieurs fois : précisez l’élément.',422);
                $before = $c['key']; $after = $c['value']; $label = 'Texte'; $node['settings']['html'] = $next;
            } elseif ($c['kind'] === 'html_style') {
                if (!in_array($c['selector'],$item['html']['selectors'] ?? [],true) || !in_array($c['key'],self::CSS_PROPERTIES,true)) self::error('Sélecteur ou propriété CSS non autorisé.',422);
                $v = trim($c['value']);
                if (!preg_match('/^[a-zA-Z0-9#.% ,()\/-]{1,120}$/',$v) || preg_match('/url|expression|var|attr|calc|image|import/i',$v)) self::error('Valeur CSS non autorisée.',422);
                if ($c['key']==='display' && !in_array($v,['none','block','flex','grid','inline','inline-block'],true)) self::error('Affichage CSS invalide.',422);
                $css = $c['selector'].'{'.$c['key'].':'.$v.'!important;}';
                $media = ['mobile'=>'(max-width:767px)','tablet'=>'(min-width:768px) and (max-width:1024px)','desktop'=>'(min-width:1025px)'];
                if ($c['device'] !== 'all') $css = '@media '.$media[$c['device']].'{'.$css.'}';
                $before = 'Styles existants (voir l’aperçu avant)'; $after = $v; $label = $c['selector'].' · '.$c['key'];
                $node['settings']['html'] .= "\n<style data-rtp1-media>".$css.'</style>';
            } else self::error('Opération non autorisée.',422);
            $diff[] = ['element'=>$item['label'],'elementId'=>$c['elementId'],'label'=>$label,'device'=>$c['device'],'before'=>$before,'after'=>$after,'reason'=>sanitize_text_field($c['reason'])];
        }
        return ['data'=>$data,'diff'=>$diff];
    }
    public static function draft($request) {
        global $wpdb;
        self::engines(); $body = $request->get_json_params(); $id = (int)($body['pageId'] ?? 0);
        $snap = self::snapshot($id);
        if (!hash_equals($snap['revision'],(string)($body['revision'] ?? ''))) self::error('La page a changé pendant l’analyse. Générez un nouveau brouillon.',409);
        $instruction = $body['instruction'] ?? ''; $scope = $body['device'] ?? 'all';
        if (!is_string($instruction) || strlen($instruction)>16000 || !in_array($scope,['all','mobile','tablet','desktop'],true)) self::error('Demande invalide.');
        $plan = self::make_changes($snap,$body['changes'] ?? [],$scope);
        $payload = ['snapshot'=>$snap,'after'=>$plan['data'],'changes'=>$body['changes'],'diff'=>$plan['diff'],'instruction'=>$instruction,'summary'=>sanitize_text_field($body['summary'] ?? ''),'device'=>$scope];
        if (strlen(wp_json_encode($payload))>4000000) self::error('Page trop volumineuse.',413);
        $draft_id = wp_generate_uuid4();
        if (!$wpdb->insert(self::table(),['id'=>$draft_id,'page_id'=>$id,'owner_id'=>get_current_user_id(),'state'=>'pending','payload'=>wp_json_encode($payload),'receipt'=>'{}','created_at'=>time(),'expires_at'=>time()+3600])) self::error('Le brouillon n’a pas pu être sauvegardé.',503);
        return self::public_draft(self::row($draft_id));
    }
    private static function row($id, $lock = false) {
        global $wpdb;
        if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/',$id)) self::error('Brouillon invalide.');
        $table = self::table();
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id=%s".($lock?' FOR UPDATE':''),$id),ARRAY_A);
        if (!$row || (int)$row['owner_id'] !== get_current_user_id()) self::error('Brouillon inaccessible.',404);
        self::check_page((int)$row['page_id']);
        $row['payload'] = json_decode($row['payload'],true,128,JSON_THROW_ON_ERROR); $row['receipt'] = json_decode($row['receipt'],true);
        return $row;
    }
    private static function public_draft($row) {
        $p=$row['payload'];
        return ['ok'=>true,'draft'=>['id'=>$row['id'],'page'=>$p['snapshot']['page'],'status'=>$row['state'],'createdAt'=>(int)$row['created_at'],'expiresAt'=>(int)$row['expires_at'],'summary'=>$p['summary'],'instruction'=>$p['instruction'],'device'=>$p['device'],'diff'=>$p['diff'],'reviewHash'=>$row['review_hash'],'receipt'=>$row['receipt']]];
    }
    public static function read_draft($r) { return self::public_draft(self::row($r['id'])); }
    public static function history() {
        global $wpdb; $table = self::table();
        $ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $table WHERE owner_id=%d ORDER BY created_at DESC LIMIT 40",get_current_user_id()));
        $drafts=[]; foreach($ids as $id) { try { $drafts[]=self::public_draft(self::row($id))['draft']; } catch(Throwable $e) {} }
        return ['ok'=>true,'drafts'=>$drafts];
    }
    public static function reject($request) {
        global $wpdb; $row=self::row($request['draftId']);
        $changed=$wpdb->update(self::table(),['state'=>'rejected','review_hash'=>''],['id'=>$row['id'],'state'=>'pending']);
        if ($changed!==1 && $row['state']!=='rejected') self::error('Ce brouillon ne peut plus être rejeté.',409);
        return ['ok'=>true];
    }
    private static function pending($row) {
        if ($row['state']!=='pending') self::error('Ce brouillon n’est plus en attente.',409);
        if ((int)$row['expires_at']<time()) self::error('Brouillon expiré. Relancez l’analyse.',410);
    }
    // Preview uses the public DOM and CSS generated in memory. It never calls Elementor save/update/enqueue.
    public static function preview($request) {
        global $wpdb; $row=self::row($request['draftId']); self::pending($row); $p=$row['payload'];
        $snap=self::snapshot((int)$row['page_id']);
        if (!hash_equals($p['snapshot']['revision'],$snap['revision'])) self::error('La page a changé. Générez un nouveau brouillon.',409);
        $url=add_query_arg('rtp1_preview_source',time(),$snap['page']['link']);
        $response=wp_safe_remote_get($url,['timeout'=>25,'redirection'=>0,'limit_response_size'=>2500000,'headers'=>['Cache-Control'=>'no-cache']]);
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response)!==200) self::error('Impossible de préparer l’aperçu de la page.',502);
        $html=wp_remote_retrieve_body($response); $dom=self::dom($html); $xpath=new DOMXPath($dom);
        if (!$xpath->query('//*[@data-elementor-id="'.(int)$row['page_id'].'"]')->length) self::error('La page affichée ne contient pas le document Elementor attendu.',422);
        $before=self::safe_preview($html,$snap['page']['link']);
        foreach ($p['changes'] as $c) {
            $element=$xpath->query('//*[contains(concat(" ",normalize-space(@class)," ")," elementor-element-'.$c['elementId'].' ")]')->item(0);
            if (!$element) self::error('Élément introuvable dans l’aperçu public.',422);
            $node =& self::find($p['after'],$c['elementId']);
            if (in_array($c['kind'],['html_text','html_style'],true)) {
                $container=$xpath->query('.//*[contains(concat(" ",normalize-space(@class)," ")," elementor-widget-container ")]',$element)->item(0) ?: $element;
                self::replace_html($dom,$container,$node['settings']['html']);
            } elseif (in_array($c['key'],['title','text','editor','link'],true)) {
                $class=['title'=>'elementor-heading-title','text'=>'elementor-button-text','editor'=>'elementor-widget-container','link'=>'elementor-button'][$c['key']];
                $target=$xpath->query('.//*[contains(concat(" ",normalize-space(@class)," ")," '.$class.' ")]',$element)->item(0);
                if (!$target && $c['key']==='editor') $target=$element;
                if (!$target) self::error('Ce contenu ne peut pas être prévisualisé précisément.',422);
                $value=$node['settings'][$c['key']];
                if ($c['key']==='link') $target->setAttribute('href',$value['url']);
                else { while($target->firstChild) $target->removeChild($target->firstChild); $target->appendChild($dom->createTextNode($value)); }
            }
        }
        $css=new class((int)$row['page_id'],$p['after']) extends \Elementor\Core\Files\CSS\Post {
            private $draft_data;
            public function __construct($id,$data) { $this->draft_data=$data; parent::__construct($id); }
            protected function get_data() { return $this->draft_data; }
        };
        $style=$dom->createElement('style'); $style->appendChild($dom->createTextNode($css->get_content())); $dom->getElementsByTagName('body')->item(0)->appendChild($style);
        $after=self::safe_preview($dom->saveHTML(),$snap['page']['link']);
        // Binding the receipt to the immutable plan prevents applying a different client-supplied patch.
        $hash=hash('sha256',wp_json_encode([$row['id'],$p['snapshot']['revision'],$p['after']]));
        $wpdb->update(self::table(),['review_hash'=>$hash],['id'=>$row['id'],'state'=>'pending']);
        return ['ok'=>true,'before'=>$before,'after'=>$after,'reviewHash'=>$hash,'notice'=>'Aperçu statique : animations, formulaires et scripts sont désactivés. Mobile ≤ 767 px ; tablette 768–1024 px.'];
    }
    private static function replace_html($dom,$target,$html) {
        $source=self::dom('<div id="rtp1-fragment">'.$html.'</div>'); $xp=new DOMXPath($source); $fragment=$xp->query('//*[@id="rtp1-fragment"]')->item(0);
        if (!$fragment) self::error('Fragment HTML non prévisualisable.',422);
        while($target->firstChild) $target->removeChild($target->firstChild);
        foreach(iterator_to_array($fragment->childNodes) as $child) $target->appendChild($dom->importNode($child,true));
    }
    private static function safe_preview($html,$base) {
        $dom=self::dom($html); $xp=new DOMXPath($dom);
        foreach(iterator_to_array($xp->query('//script|//iframe|//object|//embed|//base|//meta[@http-equiv]')) as $node) $node->parentNode->removeChild($node);
        foreach($xp->query('//*') as $node) {
            foreach(iterator_to_array($node->attributes) as $attr) if (stripos($attr->name,'on')===0 || in_array($attr->name,['srcdoc','action','formaction','autofocus'],true)) $node->removeAttribute($attr->name);
            if ($node->tagName==='a') $node->removeAttribute('href');
        }
        $head=$dom->getElementsByTagName('head')->item(0); $b=$dom->createElement('base'); $b->setAttribute('href',$base); $head->insertBefore($b,$head->firstChild);
        $policy=$dom->createElement('meta'); $policy->setAttribute('http-equiv','Content-Security-Policy');
        $policy->setAttribute('content',"default-src 'none'; script-src 'none'; connect-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https: data:; media-src 'none'; form-action 'none'; base-uri https://road-to-p1.com");
        $head->insertBefore($policy,$head->firstChild);
        $style=$dom->createElement('style','.elementor-invisible{visibility:visible!important}form,button{pointer-events:none!important}'); $head->appendChild($style);
        return '<!doctype html>'.$dom->saveHTML();
    }
    public static function apply($request) { return self::write($request,false); }
    public static function rollback($request) { return self::write($request,true); }
    private static function write($request,$rollback) {
        global $wpdb;
        if ($request['confirm']!==true) self::error('Validation explicite obligatoire.');
        self::engines(); $id=$request['draftId'];
        if ($wpdb->query('START TRANSACTION')===false) self::error('Transaction indisponible.',503);
        try {
            $row=self::row($id,true); $p=$row['payload'];
            if ((!$rollback && $row['state']==='applied') || ($rollback && $row['state']==='rolled_back')) { $wpdb->query('ROLLBACK'); return self::public_draft($row)+['idempotent'=>true]; }
            if (!$rollback) {
                self::pending($row);
                if (!$row['review_hash'] || !hash_equals($row['review_hash'],(string)$request['reviewHash'])) self::error('Ouvrez l’aperçu avant de valider ce brouillon.',409);
            } elseif ($row['state']!=='applied') self::error('Aucune publication à annuler pour ce brouillon.',409);
            $current=self::snapshot((int)$row['page_id'],true);
            $expected=$rollback ? ($row['receipt']['afterRevision'] ?? '') : $p['snapshot']['revision'];
            if (!hash_equals($current['revision'],$expected)) self::error('La page a changé depuis le brouillon ou la publication. Opération bloquée pour préserver ces changements.',409);
            $raw=$rollback ? $p['snapshot']['raw'] : wp_json_encode($p['after'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            // Original data and receipt live in the same transaction as the page update.
            $count=$wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value=%s WHERE meta_id=%d AND BINARY meta_value=BINARY %s",$raw,$current['metaId'],$current['raw']));
            if ($count!==1) self::error('La page a changé au moment de l’écriture.',409);
            if ($wpdb->update($wpdb->posts,['post_modified'=>current_time('mysql'),'post_modified_gmt'=>current_time('mysql',true)],['ID'=>(int)$row['page_id']])===false) self::error('Date de modification non enregistrée.',503);
            $after=self::snapshot((int)$row['page_id'],true);
            if ($after['raw']!==$raw) self::error('Vérification de la sauvegarde impossible.',503);
            $receipt=['publishedAt'=>time(),'beforeRevision'=>$current['revision'],'afterRevision'=>$after['revision'],'backupId'=>$id,'action'=>$rollback?'rollback':'apply'];
            $state=$rollback?'rolled_back':'applied';
            if ($wpdb->update(self::table(),['state'=>$state,'receipt'=>wp_json_encode($receipt)],['id'=>$id])!==1) self::error('La sauvegarde et son reçu n’ont pas été enregistrés.',503);
            if ($wpdb->query('COMMIT')===false) self::error('Confirmation de transaction indisponible. Consultez l’historique.',503);
        } catch(Throwable $e) { $wpdb->query('ROLLBACK'); throw $e; }
        $warning='';
        try {
            clean_post_cache((int)$row['page_id']); wp_cache_delete((int)$row['page_id'],'post_meta');
            delete_post_meta((int)$row['page_id'],'_elementor_element_cache');
            \Elementor\Core\Files\CSS\Post::create((int)$row['page_id'])->update();
            do_action('rtp1_media_after_apply',(int)$row['page_id']);
            if (function_exists('wpo_cache_flush')) wpo_cache_flush();
        } catch(Throwable $e) { $warning='Modification enregistrée ; la régénération du cache doit être vérifiée.'; }
        $verified=self::snapshot((int)$row['page_id']);
        if (!hash_equals($receipt['afterRevision'],$verified['revision'])) $warning='La modification a été enregistrée, puis la page a changé. Vérifiez son état avant toute autre action.';
        $result=self::public_draft(self::row($id)); $result['message']=$rollback?'Version précédente restaurée.':'Modification enregistrée dans WordPress.'; $result['warning']=$warning;
        return $result;
    }
    public static function quota($request) {
        global $wpdb;
        $kind=$request['kind']; if (!in_array($kind,['draft','transcribe'],true)) self::error('Quota invalide.');
        $key='rtp1_media_quota_'.get_current_user_id().'_'.$kind.'_'.gmdate('YmdH');
        $wpdb->query($wpdb->prepare("INSERT INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,'1','off') ON DUPLICATE KEY UPDATE option_value=CAST(option_value AS UNSIGNED)+1",$key));
        $count=(int)$wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s",$key));
        if ($count<1 || $count>30) self::error('Limite de 30 demandes par heure atteinte. Réessayez plus tard.',429);
        return ['ok'=>true];
    }
}
register_activation_hook(__FILE__,['RTP1_Media','install']);
add_action('rest_api_init',['RTP1_Media','routes']);
