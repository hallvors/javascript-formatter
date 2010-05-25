(function(opera){

	/* options */
var rewriteEval=false; // override window.eval() - might fail with some scripts, for example Google maps.
// this option is entirely ignored on maps.google.*


//opera.postError('scriptformatter active');
	function prettyPrintJavaScript( theCode, evalMode, src ){ // if(evalMode)opera.postError(theCode.substr(0,30));
//		if(src)opera.postError('formatting '+(src?src:evalMode?'eval script':'inline script')+'...');
		if(!theCode){opera.postError('prettyPrintJavaScript failed for '+theCode+' '+src);return '/*nothing*/';}
		/* defining the various scopes we care about for this excercise */
		var CODE = 0;  /* normal JS code */
		var STRING_DBL = 1;  /* double quoted string */
		var STRING_SGL = 2;  /* single quoted string */
		var REGEXP = 3 ; /* regexp literal */
		var ESCAPE = 4 ; /* some escape char (backslash) */
		var MULTI_LINE_COMMENT = 5 ;
		var SINGLE_LINE_COMMENT = 6 ;
		var REGEXP_CHAR_CLASS  = 7; /* inside a [ ... ] clause in a regular expression. Requires its own scope because /[/]/ is a valid regexp */

		var theStart;

		theStart = (new Date()).getTime();

		var $output=''; /* would array perform better as in JS? */
		var $num_indents = 0;
		var current_index = 0;
		var current_letter='';

		var theScope = CODE;
		var $before_escape_scope=0;
		var $at_start_of_statement_or_expression=true; /* used to distinguish divisor from regexp literal */
		var $last_complete_word = ''; /* some rudimentary tokenisation is required for the divisor-or-regexp problem */
		var $statement_words = ['return', 'typeof', 'instanceof', 'break', 'continue', 'delete', 'in', 'new', 'throw'];
		var newLine = /*(evalMode ? '\\':'')+*/"\n";
		while( current_index <   theCode.length   ){
			current_letter =  theCode.charAt( current_index );
			//echo ( (time() - theStart). "ms elapsed, now on current_index / ".strlen(theCode)." current_letter, mode: theScope \n");
			$pre = ''; /* add this string *before* this character when constructing output */
			$post = ''; /* add this string *after* this character when constructing output */
			switch( current_letter ){
				case '"': /* double quote */
					switch( theScope ){
						case STRING_DBL:
							theScope=CODE ; break; /* a non-escaped quote inside string terminates string */
						case ESCAPE:
							theScope = $before_escape_scope; break; /* the quote was escaped, return to previous scope */
						case CODE:
							theScope = STRING_DBL ; /* start-of-string double quote */
							$at_start_of_statement_or_expression=false;
					}
					break;
				case '\'': /* single quote */
					switch( theScope ){
						case STRING_SGL:
							theScope=CODE ; break; /* a non-escaped quote inside string terminates string */
						case ESCAPE:
							theScope = $before_escape_scope; break; /* the quote was escaped, return to previous scope */
						case CODE:
							theScope = STRING_SGL ;  /* start-of-string single quote */
							$at_start_of_statement_or_expression=false;
					}
					break;
				case '\\':
					if( theScope == STRING_DBL || theScope == STRING_SGL || theScope == REGEXP || theScope == REGEXP_CHAR_CLASS ){
						$before_escape_scope = theScope ;
						theScope = ESCAPE ; /* next character not to be taken seriously (well..) */
					}else if( theScope == ESCAPE ){ /* handle escaped backslashes "\\" */
						theScope = $before_escape_scope ;
					}
					break;
				case '/':
					if( theScope == CODE ){ /* lookahead: start of comment or something else? */
						//alert( $at_start_of_statement_or_expression+' '+$last_complete_word );
						$tmp =  theCode.charAt( current_index+1 );
						if( $tmp == '*' ){ /* start of multi-line comment */
							theScope = MULTI_LINE_COMMENT ;
						}else if( $tmp == '/' ){ /* start of single-line comment */
							theScope = SINGLE_LINE_COMMENT ;
						}else if( $at_start_of_statement_or_expression || in_array( $last_complete_word, $statement_words ) ){ /* start of regexp */
							theScope = REGEXP ;
						}
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}else if( theScope == REGEXP ){
						theScope = CODE ;
					}else if( theScope == MULTI_LINE_COMMENT ){ /* time to leave the comment?? */
						$tmp =  theCode.charAt( current_index-1 );
						if( $tmp == '*' ) theScope = CODE ; /* we only enter multi-line-comment mode from CODE scope AFAIK */
					}
					break;
				case '{':
					if(  theScope == CODE ){ /* start-of-block curly brace */
						/* Sigbjørn special: do not wrap and indent empty blocks (object literal) */
						if( lookahead( theCode, current_index, true )=='}' ){ /* we have an object literal. We'll simply add a closing brace and jump ahead */
							current_index=theCode.indexOf( '}', current_index );
							$post='}';
							break;
						}
						$num_indents ++ ;
						if( theCode.charAt(current_index+1) !='\n' ){
							$post = newLine;
							$post += str_repeat(  "\t", $num_indents  );
						}
						$at_start_of_statement_or_expression = true;
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				case '}':
					if(  theScope == CODE ){ /* end-of-block curly brace */
						if(  $num_indents>0  )$num_indents -- ;
						$pre = newLine;
						$pre += str_repeat(  "\t", $num_indents  );
						$post =  ( theCode.charAt(current_index+1) !='\n' ? newLine : '' ) + str_repeat(  "\t", $num_indents ) ;
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				case ';':
		//		case ',':
					if(  theScope == CODE ){ /* end-of-statement semicolon //, or between-variables comma */
						$post = ( theCode.charAt(current_index+1) !='\n' ? newLine : '' );
						$post += str_repeat(  "\t", $num_indents  );
						$at_start_of_statement_or_expression = true;
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				case "\n":
					if( theScope == SINGLE_LINE_COMMENT ){
						theScope = CODE; /* we only enter SINGLE_LINE_COMMENT mode from CODE, right?  */
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					} /* no break, we want to get to the $at_start_of_statement_or_expression bit below */
				case '(':
				case '!':
				case '=':
				case '-':
				case '+':
				case '?':
				case '*':
				case '&':
				case ':':
				case ',':
				case '|':
					if( theScope == CODE ){
						$at_start_of_statement_or_expression=true; /* at start of parens, after equal sign etc.. if the next char is a forward slash it will be a start-of-regexp, not a divisor */
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				case '[':
					if( theScope == REGEXP ){
						theScope=REGEXP_CHAR_CLASS;
						$at_start_of_statement_or_expression=false;
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				case ']':
					if( theScope == REGEXP_CHAR_CLASS ){
						theScope=REGEXP;
						$at_start_of_statement_or_expression=false;
					}else if( theScope == ESCAPE ){
						theScope = $before_escape_scope ;
					}
					break;
				default:
					if( theScope == ESCAPE ){
						theScope = $before_escape_scope ; /* always drop out of escape mode on next character..  yes, multi-char escapes exist but it's OK to treat the rest of it as part of the string or regexp */
					}
					if( theScope == CODE ){
						if( !( current_letter==' ' || current_letter=='\t' ) ) $at_start_of_statement_or_expression = false;
					}
					break;
			}
			if( current_letter.match(/[a-zA-Z0-9]/) ){
				/* if the previous character was whitespace or punctuation, this starts a new word.. */
				if( ! theCode.charAt(current_index-1).match(/[a-zA-Z0-9]/) ){
					//opera.postError(theCode.charAt(current_index-1)+' not a match for [a-zA-Z0-9] ');
					$last_complete_word='';
				}
				$last_complete_word += current_letter;
			}


		//	if( theScope == CODE &&  ( current_letter == "\t" || current_letter == "\n" ) ){ /* this script will add formatting whitespace */ // proven too fragile..
		//
		//	}else{
				$output += $pre + current_letter + $post ;
		//	}
			current_index++;
		}
		// trying to reformat eval()ed code - experimental!
		// using string replace rather than overriding eval() because there are some subtle scoping issues
		// where eval()ed code only runs in the expected scope if called as window.eval() - or something like that
		// $output = $output.replace( /eval\s*\((\w+)/g, 'eval(window.opera.prettyPrintJavaScript($1,true))' );
		// Google Maps hack:
		if(location.hostname.indexOf('maps.google')==0){
			$output = $output.replace( /callback\(req.responseText\)/g, 'callback(window.opera.prettyPrintJavaScript(req.responseText,true))' );
		}else if(rewriteEval){
			var myEval=window.eval;
			window.eval=function(){
				arguments[0]=window.opera.prettyPrintJavaScript(arguments[0],true);
				return myEval(arguments[0]);
			}
 			var myFunction=window.Function;
			window.Function=function(){
				arguments[arguments.length-1]=window.opera.prettyPrintJavaScript(arguments[arguments.length-1], true);
				return myFunction.apply(null, arguments);
			} /**/
		}

		return $output;
	}
	function str_repeat( str, count ){
		var tmp = new Array(count);
		return tmp.join(str);
	}
	function in_array(needle, haystack){
		for(var i=0,el;el=haystack[i];i++){
			if( el==needle )return true;
		}
		return false;
	}
	function lookahead(str, index, ignore_whitespace){ /* returns next character, potentially ignoring whitespace */
		var chr = str.substr( index+1, 1 );
		while(  ignore_whitespace && index<str.length && /^\s+$/.test(chr) ){
			index++;
			chr = str.substr( index+1, 1 );
		}
		return chr ? chr : ''; /* if we've gone past end of string, substr() returns false - we'd rather return '' */
	}
	window.opera.prettyPrintJavaScript=prettyPrintJavaScript;
	opera.addEventListener( 'BeforeScript', function( e ){
		//opera.postError('will format '+e.element.src+' '+e.element.defer);
		e.element.text = prettyPrintJavaScript(e.element.text, false, e.element.src);
	}, false);

/* 	var originalEval = window.eval;
	window.eval = function(str){
		var newstr=prettyPrintJavaScript(str, true);
		try{
			return originalEval(newstr);
		}catch(e){opera.postError('trying to work around '+e.message);}
		return originalEval(str);
} */
/* 	opera.addEventListener('BeforeExternalScript', function(e){
		if(e.element.hasAttribute('defer'))e.element.removeAttribute('defer');
	}, false); */
	/* Frameworks like Dojo use XHR to load JS */
	/* luckily this only works for same-origin scripts, so we can build a list and XHR them too during inlining */
	var xhrScriptsList=[];
	(function(open){
		XMLHttpRequest.prototype.open=function(){
			if( /\.js$/i.test(arguments[0]) )xhrScriptsList.push(arguments[0]);
			open.apply(this, arguments)
		}
	})(XMLHttpRequest.prototype.open);

opera.addEventListener('BeforeEvent.dblclick', function(e){
	if(e.event.ctrlKey){
		/*
			GOAL: *raw* markup (from server) with all scripts that can be easily inlined, inlined.
		*/
		var x = new XMLHttpRequest();
		x.open('GET', location.href, false);
		x.send(null);
		var thesrc=x.responseText;
		var tmpdom=document.createElement('html');
		tmpdom.innerHTML=x.responseText;
		if(tmpdom.getElementsByTagName('html')[0]){ // avoid nested <html> tags, keep the inner one
			tmpdom=tmpdom.getElementsByTagName('html')[0];
			tmpdom=tmpdom.parentNode.removeChild(tmpdom);
		}
		if(xhrScriptsList.length){ // think some scripts were loaded with XHR here.. let's add them for inlining..
			for(var i=0,src;src=xhrScriptsList[i];i++){
				var script=tmpdom.appendChild(document.createElement('script'));
				script.setAttribute('declare', 'declare');
				script.src=src;
			}
		}
		for(var srcScriptList=document.getElementsByTagName('script'),i=0,srcScript,src;srcScript=srcScriptList[i];i++){
			if(src=srcScript.getAttribute('src')){
				var found=false;
				for(var targetScriptList=tmpdom.getElementsByTagName('script'),j=0,targetScript; targetScript=targetScriptList[j]; j++){ // replace code of all script elements with this source URL
					if(targetScript.getAttribute('src')===src){
						targetScript.appendChild(document.createTextNode('/* .. inlined from '+srcScript.src+' .. */\n\n'+srcScript.text.replace(/<\/script>/gi, '<\\/script>')));
						targetScript.removeAttribute('src');
						found=true;
					}
				}
				if( ! found ){ /* there is a script in the DOM that wasn't in the original markup..?
					EXPERIMENTAL:  We add it to HEAD of the document. This can cause errors, it may be better to add after the previously seen script?
					*/
					var script=document.createElement('script');
					script.appendChild(document.createTextNode('/* .. inlined from '+srcScript.src+' .. (originally added through DOM) */\n\n'+srcScript.text.replace(/<\/script>/gi, '<\\/script>')));
					tmpdom.getElementsByTagName('head')[0].appendChild(script);
				}
				/*if( thesrc.indexOf(src)>-1 ){
					var urloffset=thesrc.indexOf(src);
					var tagContentsStart=thesrc.indexOf( '>', urloffset )+1;
					// this will fail under *many* conditions! mixed case being one
					var tagContentsEnd=thesrc.indexOf('</script>', tagContentsStart);
					if(tagContentsEnd==-1)tagContentsEnd=thesrc.indexOf('</SCRIPT>', tagContentsStart);
					var srcAttrStart=thesrc.lastIndexOf(' src', urloffset);
					if(srcAttrStart==-1)srcAttrStart=thesrc.lastIndexOf(' SRC', urloffset); // crude - will fail on sRc= or SRc= but those are rare
					if(srcAttrStart==-1||tagContentsEnd==1)continue; // haven't found such a src attribute or end tag after all.. would mangle source

					thesrc=thesrc.substr(0, srcAttrStart)+'>\n/* inlined from '+src+' *'++'/\n\n'+s.text+thesrc.substr(tagContentsEnd); // remove (presumably) SRC attribute - maybe other attributes too, don't care much about those - and insert script inline

				}else{
					opera.postError( 'did not find script tag for '+src+' in unparsed markup' );
				}
//				s.appendChild(document.createTextNode('/* .. inlined from '+s.src+' .. *'++'/\n\n'+s.text.replace(/<\/script>/gi, '<\\/script>')));
//				s.removeAttribute('src');
				*/
			}
		}
		/* styles too... */
		for(var srcLinksList=document.getElementsByTagName('link'), srcLink, i=0; srcLink=srcLinksList[i]; i++){
			if( (src=srcLink.getAttribute('href')) && srcLink.sheet ){ // opera.postError(src+' '+thesrc);
				var usedCSS='';
				try{
					for(var j=0,rule; rule=srcLink.sheet.cssRules[j]; j++){
						usedCSS+=rule.cssText+'\n';
					}
				}catch(e){
					opera.postError('Warning: could not inline '+srcLink.href);
					continue;
				}
				for(var targetLinkList=tmpdom.getElementsByTagName('link'),j=0,targetLink; targetLink=targetLinkList[j]; j++){ // replace code of all LINK elements with this href
					if(targetLink.getAttribute('href')===src){
						var style=document.createElement('style');
						if(targetLink.type)style.type=targetLink.type;
						if(targetLink.media)style.media=targetLink.media;
						style.appendChild(document.createTextNode('/* .. inlined from '+targetLink.href+' .. */\n\n'+prettyPrintJavaScript(usedCSS))); // experimental pretty-printing - is syntax similar enough? should be..
						targetLink.parentNode.replaceChild(style, targetLink);
					}
				}
				/*if( thesrc.indexOf(src)>-1 ){
					urloffset=thesrc.indexOf(src);
					tagContentsEnd=thesrc.indexOf( '>', urloffset )+1;
					tagContentsStart=thesrc.lastIndexOf('<', urloffset);
					if(tagContentsEnd==-1 || tagContentsStart==-1)continue;
					var usedCSS='';
					for(var j=0,rule; rule=link.sheet.cssRules[j]; j++){
						usedCSS+=rule.cssText+'\n';
					}
					opera.postError('will now slice and dice - '+tagContentsStart+' '+tagContentsEnd);
					thesrc=thesrc.substr(0, tagContentsStart)+'<style type="text/css">\n/* inlined from '+src+' *'++'/\n\n'+prettyPrintJavaScript(usedCSS)+'\n\n</style>'+thesrc.substr(tagContentsEnd); // remove (presumably) SRC attribute - maybe other attributes too, don't care much about those - and insert script inline

				}else{
					opera.postError( 'did not find link tag for '+src+' in unparsed markup' );
				}*/

			}
		}
		//alert('all scripts inlined!');
		window.open('data:,'+encodeURIComponent('<!DOCTYPE html>'+tmpdom.outerHTML));
	}
}, false);


})(window.opera);
/*
if(location.hostname.indexOf('orkut.com')>-1){
	var docqsa=document.querySelectorAll;
	document.querySelectorAll=function(){
		var output=[];
		var tmp=docqsa.apply(this,arguments);
		for(var tmpi=0;tmpi<tmp.length;tmpi++){
			output.push(tmp[tmpi]);
		}
		return output;
	}
	//=document.getElementsByClassName=null;
	window.opera=null;
	navigator.userAgent='Mozilla/5.0 (Windows; U; Windows NT 5.1; nn-NO; rv:1.9.0.9) Gecko/2009040821 Firefox/3.0.9';
	navigator.appName='Netscape';
	navigator.product='Gecko';
}
//for(var c=this.R("span","ownPresenceText",this.Fc),d=c[if_Ea](this.R("span","ownPresenceText")),e=0; e<d[if_m]; e++
*/


